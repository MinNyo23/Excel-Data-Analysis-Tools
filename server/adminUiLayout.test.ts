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

  it("styles the ban and delete confirm dialog with solid site UI classes", () => {
    const adminPage = readFileSync(path.resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    const styles = readFileSync(path.resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(adminPage).toContain("admin-confirm-dialog");
    expect(adminPage).toContain("admin-confirm-cancel");
    expect(adminPage).toContain("admin-confirm-ban");
    expect(adminPage).toContain("admin-confirm-delete");
    expect(styles).toContain(".admin-confirm-dialog");
    expect(styles).toContain("background: #ffffff !important");
  });

  it("allows the authenticated workspace content to push the footer to the bottom", () => {
    const layout = readFileSync(path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

    expect(layout).toContain('<main className="flex-1">{children}</main>');
    expect(layout).toContain("<AppFooter />");
  });
});
