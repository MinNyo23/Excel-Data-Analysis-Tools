import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { processDeletionWithSummary } from "./deletionWithSummaryProcessor";

describe("deletion with summary processor", () => {
  it("counts entities across preserved source sheets and adds a total", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "entity-summary-")); const input = path.join(dir, "input.xlsx"); const output = path.join(dir, "Entity_Summary_Final_Report.xlsx");
    try {
      execFileSync("python3", [path.resolve(process.cwd(), "scripts/create_multi_sheet_test_workbook.py"), input]);
      const result = await processDeletionWithSummary({ name: "input.xlsx", data: readFileSync(input).toString("base64") });
      expect(result.sheetNames).toEqual(["Entity Summary", "Clean Data", "Duplicates Moved"]);
      expect(result.summary.rows).toEqual([[1, "Alpha", 1, 1, 2], [2, "Beta", 1, 0, 1], ["", "TOTAL", 2, 1, 3]]);
      writeFileSync(output, Buffer.from(result.workbookBase64, "base64"));
      const inspected = JSON.parse(execFileSync("python3", [path.resolve(process.cwd(), "scripts/inspect_workbook.py"), output], { encoding: "utf8" }));
      expect(inspected.sheetNames).toEqual(["Entity Summary", "Clean Data", "Duplicates Moved"]);
      expect(inspected.rows["Entity Summary"][1]).toEqual([1, "Alpha", 1, 1, 2]);
      expect(inspected.rows["Clean Data"][1]).toEqual(["Alpha", 1]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
