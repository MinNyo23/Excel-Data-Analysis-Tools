import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const profilePage = readFileSync(resolve(root, "client/src/pages/ProfileSettings.tsx"), "utf8");
const routes = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const sidebar = readFileSync(resolve(root, "client/src/components/DashboardLayout.tsx"), "utf8");

describe("dedicated profile and history page", () => {
  it("uses protected profile and user-scoped metadata-history queries without workbook fields", () => {
    expect(profilePage).toContain("trpc.profile.me.useQuery");
    expect(profilePage).toContain("trpc.profile.update.useMutation");
    expect(profilePage).toContain("trpc.processHistory.list.useQuery");
    expect(profilePage).toContain("trpc.processHistory.retention.update.useMutation");
    expect(profilePage).toContain("trpc.processHistory.clear.useMutation");
    expect(profilePage).toContain("Uploaded workbooks, worksheet rows, previews, and generated files are never saved.");
    expect(profilePage).not.toContain("workbookBase64");
  });

  it("exposes the protected page through an explicit route and sidebar navigation item", () => {
    expect(routes).toContain('<Route path={"/profile"}><AuthGate><ProfileSettings /></AuthGate></Route>');
    expect(sidebar).toContain('location === "/profile"');
    expect(sidebar).toContain("My profile");
  });
});
