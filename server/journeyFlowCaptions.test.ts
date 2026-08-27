import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("journey-flow step captions", () => {
  it("provides a semantic, plain-language explanation for all seven journey steps", () => {
    const component = projectFile("client/src/components/JourneyFlowCaptions.tsx");

    expect(component).toContain("<ol>");
    expect(component).toContain('aria-labelledby="journey-flow-captions-title"');
    expect(component).toContain("What each step means");
    ["Sign in", "Choose a workflow", "Select valid files", "Start processing", "Process in memory", "Review the result", "Download the workbook"].forEach(step => {
      expect(component).toContain(step);
    });
    expect(component).toContain("not saved to the application database");
  });

  it("uses an adaptive two-column caption layout that becomes one column on mobile", () => {
    const styles = projectFile("client/src/privacy-diagram.css");

    expect(styles).toContain(".journey-flow-captions ol");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(styles).toContain("@media (max-width: 680px)");
    expect(styles).toContain(".journey-flow-captions ol { grid-template-columns: 1fr; }");
  });
});
