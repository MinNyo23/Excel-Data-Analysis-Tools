import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(process.cwd());
const homeSource = readFileSync(path.join(projectRoot, "client/src/pages/Home.tsx"), "utf8");
const guideSource = readFileSync(path.join(projectRoot, "client/src/components/WorkflowGuide.tsx"), "utf8");

describe("workflow sample templates", () => {
  it("provides downloadable CSV and XLSX examples for every workflow", () => {
    const templateBlocks = homeSource.match(/templates: \[[\s\S]*?\n    \],/g) ?? [];

    expect(templateBlocks).toHaveLength(8);
    for (const templateBlock of templateBlocks) {
      expect(templateBlock).toContain("format: \"CSV\"");
      expect(templateBlock).toContain("format: \"XLSX\"");
      expect(templateBlock).toContain("/manus-storage/");
    }
  });

  it("labels paired-file examples clearly for matching workflows", () => {
    expect(homeSource).toContain('label: "Original Addition"');
    expect(homeSource).toContain('label: "Exit Data"');
    expect(homeSource).toContain('label: "Original Onboard"');
    expect(homeSource).toContain('label: "Deletion list"');
  });

  it("downloads templates through an accessible reusable control", () => {
    expect(guideSource).toContain("SAMPLE FILES");
    expect(guideSource).toContain("onDownloadTemplate(template)");
    expect(guideSource).toContain("Download a privacy-safe example");
    expect(homeSource).toContain("async function downloadSampleTemplate");
    expect(homeSource).toContain('anchor.download = template.filename');
  });
});
