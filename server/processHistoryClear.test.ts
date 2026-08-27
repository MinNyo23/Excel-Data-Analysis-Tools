import { describe, expect, it } from "vitest";
import { deleteProcessHistoryForUser } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function containsValue(value: unknown, target: unknown, seen = new Set<unknown>()): boolean {
  if (value === target) return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value as Record<string, unknown>).some(child => containsValue(child, target, seen));
}

describe("process history clear", () => {
  it("rejects unauthenticated attempts to delete process metadata", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    await expect(appRouter.createCaller(ctx).processHistory.clear()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("builds a delete statement scoped to the authenticated user's id", async () => {
    let receivedCondition: unknown;
    const db = {
      delete: () => ({
        where: async (condition: unknown) => {
          receivedCondition = condition;
          return [{ affectedRows: 3 }];
        },
      }),
    };

    await deleteProcessHistoryForUser(db, 42);

    expect(containsValue(receivedCondition, "userId")).toBe(true);
    expect(containsValue(receivedCondition, 42)).toBe(true);
  });
});
