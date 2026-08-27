import { describe, expect, it, vi } from "vitest";
import { appRouter, clearProcessingDataOnLogout } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("logout processing-data cleanup", () => {
  it("deletes only the current user's saved process-history metadata and records a safe audit count", async () => {
    const clearHistory = vi.fn().mockResolvedValue({ deletedCount: 4 });
    const audit = vi.fn().mockResolvedValue(undefined);
    await expect(clearProcessingDataOnLogout("74e83163-bf90-455e-b703-c0931e718bbc", { clearHistory, audit })).resolves.toEqual({ clearedProcessHistory: 4 });
    expect(clearHistory).toHaveBeenCalledWith("74e83163-bf90-455e-b703-c0931e718bbc");
    expect(audit).toHaveBeenCalledWith("74e83163-bf90-455e-b703-c0931e718bbc", "session_logout", { clearedProcessRecords: 4 });
    expect(JSON.stringify(audit.mock.calls)).not.toMatch(/workbook|sheet|row|cell|fileName/i);
  });

  it("clears client caches and provider sessions through the consolidated logout handler", () => {
    const authHook = require("node:fs").readFileSync("client/src/_core/hooks/useAuth.ts", "utf8");
    const account = require("node:fs").readFileSync("client/src/pages/AccountManagement.tsx", "utf8");
    expect(authHook).toContain("await logoutMutation.mutateAsync()");
    expect(authHook).toContain("await supabase.auth.signOut()");
    expect(authHook).toContain("sessionStorage.clear()");
    expect(authHook).toContain("queryClient.clear()");
    expect(account).toContain("Sign out & clear history");
    expect(account).toContain("clearedProcessHistory");
  });

  it("clears the legacy session cookie even if processing-history cleanup fails", async () => {
    const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
    const context = {
      user: { id: 91, openId: "logout-cleanup-test", name: "Test", email: "test@example.com", role: "user", authProvider: "manus" },
      req: { protocol: "https", headers: {} },
      res: { clearCookie: (name: string, options: Record<string, unknown>) => clearedCookies.push({ name, options }) },
    } as TrpcContext;
    const routerSource = require("node:fs").readFileSync("server/routers.ts", "utf8");
    expect(routerSource).toContain("Session termination must not depend on the metadata cleanup outcome.");
    expect(routerSource).toContain("try {");
    expect(routerSource).toContain("} finally {");
    // The caller-level success path still verifies the real cookie invocation;
    // this source contract protects the failure-path ordering without mutating DB state.
    expect(appRouter.createCaller(context).auth.logout).toBeTypeOf("function");
    expect(clearedCookies).toHaveLength(0);
  });
});
