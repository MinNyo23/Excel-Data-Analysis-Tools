import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("in-app privacy processing diagram", () => {
  it("shows the managed processing diagram with meaningful alternative text", () => {
    const page = projectFile("client/src/pages/Home.tsx");
    expect(page).toContain('<details className="privacy-details" open>');
    expect(page).toContain('src="/manus-storage/backend-upload-to-output-flow_81585e5f.png"');
    expect(page).toContain("Open the full-size diagram");
    expect(page).toContain('alt="Backend processing sequence: authenticated CSV or XLSX uploads are validated');
    expect(page).toContain("The database receives optional account and process metadata only.");
  });

  it("keeps the wide sequence diagram usable on small screens", () => {
    const styles = projectFile("client/src/privacy-diagram.css");
    expect(styles).toContain(".privacy-diagram-viewport");
    expect(styles).toContain("overflow-x: auto");
    expect(styles).toContain("@media (max-width: 680px)");
  });
});
