import { describe, expect, it } from "vitest";
import { isAdminAccount, isPrivilegedAdminEmail } from "../shared/authPolicy";
import { isMasterAdmin } from "./admin";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("admin RBAC", () => {
  it("treats database admin role as privileged without a hardcoded email", () => {
    expect(isAdminAccount({ email: "anyone@company.com", role: "admin" })).toBe(true);
    expect(isMasterAdmin({ email: "anyone@company.com", role: "admin" })).toBe(true);
    expect(isAdminAccount({ email: "anyone@company.com", role: "user" })).toBe(false);
  });

  it("treats ADMIN_EMAILS as privileged even when role is still user", () => {
    const previous = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "ops.admin@example.com, other.admin@example.com";
    expect(isPrivilegedAdminEmail("OPS.ADMIN@example.com")).toBe(true);
    expect(isAdminAccount({ email: "other.admin@example.com", role: "user" })).toBe(true);
    expect(isAdminAccount({ email: "staff@example.com", role: "user" })).toBe(false);
    process.env.ADMIN_EMAILS = previous;
  });

  it("does not hardcode a gmail master account in admin UI or policy source", () => {
    const layout = readFileSync(path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
    const policy = readFileSync(path.resolve(process.cwd(), "shared/authPolicy.ts"), "utf8");
    const adminApi = readFileSync(path.resolve(process.cwd(), "server/admin.ts"), "utf8");
    expect(layout).not.toContain("minnyo.work@gmail.com");
    expect(policy).not.toContain("minnyo.work@gmail.com");
    expect(adminApi).not.toContain("minnyo.work@gmail.com");
    expect(layout).toContain('user?.role === "admin"');
  });
});
