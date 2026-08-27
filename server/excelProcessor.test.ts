import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { processExcelFiles } from "./excelProcessor";

const projectRoot = path.resolve(process.cwd());

function createWorkbookFixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "excel-master-test-"));
  const workbookPath = path.join(directory, "source-one.xlsx");
  execFileSync("python3", [path.join(projectRoot, "scripts/create_test_workbook.py"), workbookPath]);
  const data = readFileSync(workbookPath).toString("base64");
  return { directory, data };
}

describe("excel processor", () => {
  it("merges real Addition and Deletion sheets and preserves the master contract", async () => {
    const fixture = createWorkbookFixture();
    let outputDirectory: string | undefined;
    try {
      const result = await processExcelFiles([
        { name: "source-one.xlsx", data: fixture.data },
        { name: "readme.txt", data: Buffer.from("not an excel file").toString("base64") },
      ]);

      expect(result.outputFilename).toBe("Master_Combined_With_Summary.xlsx");
      expect(result.fileCount).toBe(1);
      expect(result.additionCount).toBe(2);
      expect(result.deletionCount).toBe(1);
      expect(result.addition.columns).toContain("Source_File");
      expect(result.addition.rows[0]).toContain("source-one");
      expect(result.deletion.columns).toContain("Source_File");
      expect(result.deletion.rows[0]).toContain("source-one");
      expect(result.summary.rows.at(-1)).toEqual(["TOTAL", 2, 1, 3]);
      expect(result.errors).toContain("Skipped unsupported file: readme.txt");

      outputDirectory = mkdtempSync(path.join(os.tmpdir(), "excel-master-output-"));
      const outputPath = path.join(outputDirectory, result.outputFilename);
      writeFileSync(outputPath, Buffer.from(result.workbookBase64, "base64"));
      const inspected = JSON.parse(execFileSync("python3", [path.join(projectRoot, "scripts/inspect_workbook.py"), outputPath], { encoding: "utf8" }));

      expect(inspected.sheetNames).toEqual(["Summary Report", "Addition", "Deletion"]);
      expect(inspected.rows.Addition[1]).toEqual(["A-100", 12, "source-one"]);
      expect(inspected.rows.Deletion[1]).toEqual(["D-300", "Leave", "source-one"]);
      expect(inspected.rows["Summary Report"].at(-1)).toEqual(["TOTAL", 2, 1, 3]);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
      if (outputDirectory) rmSync(outputDirectory, { recursive: true, force: true });
    }
  });
});
