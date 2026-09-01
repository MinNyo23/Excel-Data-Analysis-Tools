import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("shielded-spreadsheet browser tab icon", () => {
  it("uses same-origin project-owned PNG assets for browser and mobile icons", () => {
    const documentHead = readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");

    expect(documentHead).toContain('<link rel="icon" type="image/png" href="/favicon.png" />');
    expect(documentHead).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(documentHead).not.toContain("manus-storage");
    expect(documentHead).not.toContain("manus.computer");
    expect(documentHead).toContain('<meta name="theme-color" content="#176a54" />');
  });

  it("ships both local icon files in the frontend public directory", () => {
    expect(existsSync(path.resolve(process.cwd(), "client/public/favicon.png"))).toBe(true);
    expect(existsSync(path.resolve(process.cwd(), "client/public/apple-touch-icon.png"))).toBe(true);
  });
});
