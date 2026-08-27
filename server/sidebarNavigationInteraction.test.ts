import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("sidebar navigation interaction contract", () => {
  it("applies the shared interaction class to workflow and account navigation buttons", () => {
    const layout = readFileSync(path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

    expect(layout).toContain('className="sidebar-navigation-link h-10');
    expect(layout.match(/sidebar-navigation-link/g)).toHaveLength(2);
    expect(layout).toContain('tooltip="My account"');
  });

  it("includes hover, active, keyboard-focus, and reduced-motion rules", () => {
    const styles = readFileSync(path.resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(styles).toContain(".sidebar-navigation-link:not([data-active=true]):hover");
    expect(styles).toContain(".sidebar-navigation-link[data-active=true]");
    expect(styles).toContain(".sidebar-navigation-link:focus-visible");
    expect(styles).toContain(".sidebar-navigation-link:active");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
  });
});
