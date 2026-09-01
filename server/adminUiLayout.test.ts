import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Master Account user-management layout", () => {
  it("uses an in-page AlertDialog instead of the browser confirm popup", () => {
    const adminPage = readFileSync(path.resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");

    expect(adminPage).toContain("AlertDialog");
    expect(adminPage).toContain("AlertDialogContent");
    expect(adminPage).toContain("setPendingAction");
    expect(adminPage).not.toContain("window.confirm");
  });

  it("allows the authenticated workspace content to push the footer to the bottom", () => {
    const layout = readFileSync(path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

    expect(layout).toContain('<main className="flex-1">{children}</main>');
    expect(layout).toContain("<AppFooter />");
  });
});
