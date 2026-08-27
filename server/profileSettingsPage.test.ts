import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const accountPage = readFileSync(resolve(root, "client/src/pages/AccountManagement.tsx"), "utf8");
const routes = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const sidebar = readFileSync(resolve(root, "client/src/components/DashboardLayout.tsx"), "utf8");

describe("unified account and history page", () => {
  it("combines protected profile and user-scoped metadata-history queries without workbook fields", () => {
    expect(accountPage).toContain("trpc.profile.me.useQuery");
    expect(accountPage).toContain("trpc.profile.update.useMutation");
    expect(accountPage).toContain("trpc.processHistory.list.useQuery");
    expect(accountPage).toContain("trpc.processHistory.retention.update.useMutation");
    expect(accountPage).toContain("trpc.processHistory.clear.useMutation");
    expect(accountPage).toContain("Uploaded workbooks, worksheet rows, previews, and generated files are never saved.");
    expect(accountPage).not.toContain("workbookBase64");
  });

  it("exposes unified controls through one protected account route and a single sidebar item", () => {
    expect(routes).toContain('<Route path={"/account"}><AuthGate><AccountManagement /></AuthGate></Route>');
    expect(routes).toContain('<Route path={"/profile"}><Redirect to="/account" /></Route>');
    expect(sidebar).toContain('location === "/account" || location === "/profile"');
    expect(sidebar).toContain("My account");
  });
});
