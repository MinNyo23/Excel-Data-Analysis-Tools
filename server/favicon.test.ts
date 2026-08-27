import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("shielded-spreadsheet browser tab icon", () => {
  it("uses the selected managed shielded-spreadsheet PNG for browser and mobile icons", () => {
    const documentHead = readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");
    const assetUrl = "https://3000-il1ewvzwfbgv4rg9wy6pi-abbe9b7d.us4.manus.computer/manus-storage/excel-master-file-shielded-spreadsheet-icon-clean_be64a292.png";

    expect(documentHead).toContain(`<link rel="icon" type="image/png" href="${assetUrl}" />`);
    expect(documentHead).toContain(`<link rel="apple-touch-icon" href="${assetUrl}" />`);
    expect(documentHead).toContain('<meta name="theme-color" content="#176a54" />');
  });

  it("keeps the approved managed asset host available to the production image policy", () => {
    const vercelConfig = readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8");

    expect(vercelConfig).toContain("img-src 'self' data: blob: https://3000-il1ewvzwfbgv4rg9wy6pi-abbe9b7d.us4.manus.computer");
  });
});
