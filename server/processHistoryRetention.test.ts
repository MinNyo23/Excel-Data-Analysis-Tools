import { describe, expect, it } from "vitest";
import { deleteExpiredProcessHistoryForUser, retentionCutoffDate } from "./db";
import { accountExportInputSchema, exportDateRange, retentionDaysSchema } from "./routers";

function containsValue(value: unknown, target: unknown, seen = new Set<unknown>()): boolean {
  if (value === target) return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value as Record<string, unknown>).some(child => containsValue(child, target, seen));
}

describe("process-history retention and export filters", () => {
  it("calculates configured retention cutoffs and preserves unlimited history", () => {
    const now = new Date("2026-08-24T00:00:00.000Z");
    expect(retentionCutoffDate(7, now)?.toISOString()).toBe("2026-08-17T00:00:00.000Z");
    expect(retentionCutoffDate(30, now)?.toISOString()).toBe("2026-07-25T00:00:00.000Z");
    expect(retentionCutoffDate(90, now)?.toISOString()).toBe("2026-05-26T00:00:00.000Z");
    expect(retentionCutoffDate(180, now)?.toISOString()).toBe("2026-02-25T00:00:00.000Z");
    expect(retentionCutoffDate(365, now)?.toISOString()).toBe("2025-08-24T00:00:00.000Z");
    expect(retentionCutoffDate(null, now)).toBeNull();
    [7, 30, 90, 180, 365, null].forEach(value => expect(retentionDaysSchema.parse(value)).toBe(value));
    expect(() => retentionDaysSchema.parse(14)).toThrow();
    expect(() => retentionDaysSchema.parse(0)).toThrow();
  });

  it("builds expired-history deletion scoped to the current user and cutoff", async () => {
    let receivedCondition: unknown;
    const db = { delete: () => ({ where: async (condition: unknown) => { receivedCondition = condition; return [{ affectedRows: 2 }]; } }) };
    const cutoff = new Date("2026-07-25T00:00:00.000Z");
    await deleteExpiredProcessHistoryForUser(db, 21, cutoff);
    expect(containsValue(receivedCondition, "userId")).toBe(true);
    expect(containsValue(receivedCondition, 21)).toBe(true);
    expect(containsValue(receivedCondition, cutoff)).toBe(true);
  });

  it("accepts bounded and open-ended export dates while rejecting invalid ranges", () => {
    const input = accountExportInputSchema.parse({ startDate: "2026-08-01", endDate: "2026-08-31" });
    expect(exportDateRange(input)).toEqual({ startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2026-08-31T23:59:59.999Z") });
    expect(exportDateRange(accountExportInputSchema.parse({ startDate: "2026-08-01" }))).toEqual({ startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: undefined });
    expect(exportDateRange(accountExportInputSchema.parse({ endDate: "2026-08-31" }))).toEqual({ startDate: undefined, endDate: new Date("2026-08-31T23:59:59.999Z") });
    expect(exportDateRange(accountExportInputSchema.parse({}))).toEqual({ startDate: undefined, endDate: undefined });
    expect(() => accountExportInputSchema.parse({ startDate: "2026-08-31", endDate: "2026-08-01" })).toThrow();
    expect(() => accountExportInputSchema.parse({ startDate: "2026-02-30" })).toThrow();
    expect(() => accountExportInputSchema.parse({ startDate: "08/01/2026" })).toThrow();
  });
});
