import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { processDeletionSummary } from "./deletionSummaryProcessor";

const projectRoot = path.resolve(process.cwd());

describe("deletion summary processor", () => {
  it("counts entities, adds a total, and exports the expected workbook tabs", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "deletion-summary-test-"));
    const inputPath = path.join(directory, "deletions.xlsx");
    const outputPath = path.join(directory, "Deletion_Entity_Summary_Report.xlsx");
    try {
      execFileSync("python3", [path.join(projectRoot, "scripts/create_deletion_test_workbook.py"), inputPath]);
      const result = await processDeletionSummary({ name: "deletions.xlsx", data: readFileSync(inputPath).toString("base64") });
      expect(result.sheetNames).toEqual(["Deletion Entity Summary", "Deletion Data"]);
      expect(result.sourceSheet).toBe("Del Aug");
      expect(result.entityColumn).toBe("Entity Name");
      expect(result.uniqueEntityCount).toBe(2);
      expect(result.deletionRowCount).toBe(4);
      expect(result.summary.rows).toEqual([[1, "North", 2], [2, "South", 1], ["", "TOTAL", 3]]);

      writeFileSync(outputPath, Buffer.from(result.workbookBase64, "base64"));
      const inspected = JSON.parse(execFileSync("python3", [path.join(projectRoot, "scripts/inspect_workbook.py"), outputPath], { encoding: "utf8" }));
      expect(inspected.sheetNames).toEqual(["Deletion Entity Summary", "Deletion Data"]);
      expect(inspected.rows["Deletion Entity Summary"].at(-1)).toEqual([null, "TOTAL", 3]);
      expect(inspected.rows["Deletion Data"][1]).toEqual(["North", "Closed"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("falls back to the first sheet when no deletion label is present", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "deletion-fallback-test-"));
    const inputPath = path.join(directory, "fallback.xlsx");
    try {
      execFileSync("python3", [path.join(projectRoot, "scripts/create_deletion_fallback_workbook.py"), inputPath]);
      const result = await processDeletionSummary({ name: "fallback.xlsx", data: readFileSync(inputPath).toString("base64") });
      expect(result.sourceSheet).toBe("Records");
      expect(result.summary.rows).toEqual([[1, "Fallback Entity", 1], ["", "TOTAL", 1]]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
