import { describe, expect, it } from "vitest";
import { appRouter, createAuthenticatedProfileExport, createProfileExport, editableUserProfileSchema } from "./routers";
import { deleteUserProfileForUser, selectUserProfileForUser } from "./db";
import type { TrpcContext } from "./_core/context";

function containsValue(value: unknown, target: unknown, seen = new Set<unknown>()): boolean {
  if (value === target) return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value as Record<string, unknown>).some(child => containsValue(child, target, seen));
}

const authenticatedContext = {
  user: { id: 21, openId: "profile-owner", name: "OAuth Name", email: "owner@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} as TrpcContext;

describe("secure user profile contracts", () => {
  it("exports only the authenticated identity and editable profile data", () => {
    const exported = createProfileExport(
      { name: "OAuth Name", email: "owner@example.com" },
      { displayName: "Owner", phoneNumber: "123", organization: "Team", jobTitle: "Analyst" },
      [{ toolKey: "ready-upload", toolName: "Ready file to upload", status: "completed", inputFileNames: "[\"source.xlsx\"]", outputFilename: "ready.xlsx", totalRecords: 4, completedAt: new Date("2026-08-20T00:00:00.000Z") }],
    );
    expect(exported).toMatchObject({ identity: { name: "OAuth Name", email: "owner@example.com" }, profile: { displayName: "Owner", phoneNumber: "123", organization: "Team", jobTitle: "Analyst" }, processHistory: [{ toolKey: "ready-upload", inputFileNames: ["source.xlsx"], outputFilename: "ready.xlsx", totalRecords: 4 }] });
    expect(Object.keys(exported).sort()).toEqual(["exportedAt", "identity", "processHistory", "profile"]);
    expect(JSON.stringify(exported)).not.toMatch(/workbookBase64|previewRows|worksheetContents/i);
  });

  it("safely excludes malformed file-name metadata from account exports", () => {
    const exported = createProfileExport(
      { name: "OAuth Name", email: "owner@example.com" }, null,
      [{ toolKey: "summary", toolName: "Summary", status: "completed", inputFileNames: "not-json", outputFilename: "summary.xlsx", totalRecords: 1, completedAt: new Date("2026-08-20T00:00:00.000Z") }],
    );
    expect(exported.processHistory[0]?.inputFileNames).toEqual([]);
    expect(JSON.stringify(exported)).not.toMatch(/not-json|workbook|preview|worksheet/i);
  });

  it("uses the authenticated user id for both exported profile and process-history metadata", async () => {
    const requestedProfileIds: number[] = [];
    const requestedHistoryIds: number[] = [];
    const cleanupIds: number[] = [];
    const requestedRanges: Array<{ startDate?: Date; endDate?: Date }> = [];
    const exported = await createAuthenticatedProfileExport(
      authenticatedContext.user!,
      { startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2026-08-31T23:59:59.999Z") },
      {
        loadProfile: async userId => { requestedProfileIds.push(userId); return { displayName: "Owner", phoneNumber: "", organization: "", jobTitle: "" }; },
        loadProcessHistory: async (userId, range) => { requestedHistoryIds.push(userId); requestedRanges.push(range); return [{ toolKey: "facility", toolName: "Facility by facility", status: "completed", inputFileNames: "[\"owner.xlsx\"]", outputFilename: "report.xlsx", totalRecords: 2, completedAt: new Date("2026-08-20T00:00:00.000Z") }]; },
        applyRetention: async userId => { cleanupIds.push(userId); return { deletedCount: 0 }; },
      },
    );
    expect(requestedProfileIds).toEqual([21]);
    expect(requestedHistoryIds).toEqual([21]);
    expect(cleanupIds).toEqual([21]);
    expect(requestedRanges).toEqual([{ startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2026-08-31T23:59:59.999Z") }]);
    expect(exported.processHistory).toEqual([expect.objectContaining({ inputFileNames: ["owner.xlsx"], outputFilename: "report.xlsx" })]);
  });

  it("builds profile reads scoped to the authenticated user's id", async () => {
    let receivedCondition: unknown;
    const db = { select: () => ({ from: () => ({ where: (condition: unknown) => ({ limit: async () => { receivedCondition = condition; return []; } }) }) }) };
    await selectUserProfileForUser(db, 21);
    expect(containsValue(receivedCondition, "userId")).toBe(true);
    expect(containsValue(receivedCondition, 21)).toBe(true);
  });

  it("rejects untrusted fields that could target another user's profile", () => {
    expect(() => editableUserProfileSchema.parse({ displayName: "Owner", phoneNumber: "", organization: "", jobTitle: "", userId: 99 })).toThrow();
  });

  it("requires authentication for profile reads and updates", async () => {
    const caller = appRouter.createCaller({ ...authenticatedContext, user: null });
    await expect(caller.profile.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.profile.update({ displayName: "", phoneNumber: "", organization: "", jobTitle: "" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.profile.export()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.profile.delete()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("builds profile deletion statements scoped to the authenticated user's id", async () => {
    let receivedCondition: unknown;
    const db = { delete: () => ({ where: async (condition: unknown) => { receivedCondition = condition; return [{ affectedRows: 1 }]; } }) };
    await deleteUserProfileForUser(db, 21);
    expect(containsValue(receivedCondition, "userId")).toBe(true);
    expect(containsValue(receivedCondition, 21)).toBe(true);
  });
});
