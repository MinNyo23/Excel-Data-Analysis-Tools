import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeGeneratedWorkbookOutput } from "./workbookOutputSecurity";

describe("generated workbook output guard", () => {
  it("converts formula-like imported cells to literal text before download", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "formula-guard-"));
    try {
      const inputPath = path.join(directory, "input.xlsx");
      const outputPath = path.join(directory, "output.xlsx");
      execFileSync("python3", [path.resolve(process.cwd(), "scripts/create_formula_injection_fixture.py"), inputPath]);
      const source = readFileSync(inputPath).toString("base64");

      const guarded = await sanitizeGeneratedWorkbookOutput({ workbookBase64: source, outputFilename: "safe.xlsx" });
      writeFileSync(outputPath, Buffer.from(guarded.workbookBase64, "base64"));
      const worksheetXml = execFileSync("unzip", ["-p", outputPath, "xl/worksheets/sheet1.xml"], { encoding: "utf8" });

      expect(guarded.outputFilename).toBe("safe.xlsx");
      expect(worksheetXml).not.toContain("<f>");
      expect(worksheetXml).toContain("'=HYPERLINK");
      expect(worksheetXml).toContain("'+1+1");
      expect(worksheetXml).toContain("'-1+1");
      expect(worksheetXml).toContain("'@SUM");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
