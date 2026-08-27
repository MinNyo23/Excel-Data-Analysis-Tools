import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("plain-language Excel workflow guides", () => {
  it("provides a reusable upload, process, result, and privacy explanation for every workflow", () => {
    const component = projectFile("client/src/components/WorkflowGuide.tsx");
    const home = projectFile("client/src/pages/Home.tsx");

    expect(component).toContain("1. Upload");
    expect(component).toContain("2. Process");
    expect(component).toContain("3. Review and download");
    expect(component).toContain("processed temporarily in memory");
    ["consolidation", "deletion-summary", "duplicates", "entity-summary", "addition-exit", "onboard", "ready-upload", "facility"].forEach(key => {
      expect(home).toMatch(new RegExp(`["']?${key}["']?\\s*:`));
    });
    expect(home).toContain("<WorkflowGuide {...activeWorkflowGuide} onDownloadTemplate={downloadSampleTemplate} />");
  });

  it("aligns master consolidation file guidance with the supported CSV and XLSX formats", () => {
    const home = projectFile("client/src/pages/Home.tsx");

    expect(home).toContain("/\\.(xlsx|csv)$/i.test(file.name)");
    expect(home).toContain("Please choose files in .csv or .xlsx format.");
    expect(home).toContain("Choose one or more CSV or XLSX corporate workbooks.");
    expect(home).not.toContain(".xlsx or .xls file");
    expect(home).not.toContain("Supports .xlsx and .xls");
  });

  it("keeps the active workflow workspace visible beneath its guide", () => {
    const styles = projectFile("client/src/index.css");

    expect(styles).toContain(".tool-app-shell:not(.tool-home) > .tool-section { display: none; }");
    expect(styles).toContain(".tool-app-shell.tool-consolidation .tool-consolidation { display: grid; margin-top: 22px; }");
    expect(styles).toContain(".tool-app-shell.tool-facility .tool-facility { display: block; margin-top: 22px; }");
  });
});
