import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { processDeletionDuplicates } from "./deletionDuplicatesProcessor";

const projectRoot = path.resolve(process.cwd());

describe("deletion duplicates processor", () => {
  it("keeps the first duplicate row and moves subsequent rows", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "deletion-duplicates-test-"));
    const inputPath = path.join(directory, "duplicates.xlsx");
    const outputPath = path.join(directory, "Processed_Duplicates_Moved.xlsx");
    try {
      execFileSync("python3", [path.join(projectRoot, "scripts/create_duplicates_test_workbook.py"), inputPath]);
      const result = await processDeletionDuplicates({ name: "duplicates.xlsx", data: readFileSync(inputPath).toString("base64") });
      expect(result.sourceSheet).toBe("Deletion Data");
      expect(result.nameColumn).toBe("Employee Full Name");
      expect(result.nrcColumn).toBe("NRC No");
      expect(result.originalCount).toBe(4);
      expect(result.cleanCount).toBe(2);
      expect(result.duplicateCount).toBe(2);
      expect(result.cleanData.rows[0]).toEqual(["Aung Aung", "NRC-1", "First"]);
      expect(result.duplicates.rows[0]).toEqual(["Aung Aung", "NRC-1", "Repeat"]);
      writeFileSync(outputPath, Buffer.from(result.workbookBase64, "base64"));
      const inspected = JSON.parse(execFileSync("python3", [path.join(projectRoot, "scripts/inspect_workbook.py"), outputPath], { encoding: "utf8" }));
      expect(inspected.sheetNames).toEqual(["Clean Data", "Duplicates Moved"]);
      expect(inspected.rows["Clean Data"][1]).toEqual(["Aung Aung", "NRC-1", "First"]);
      expect(inspected.rows["Duplicates Moved"][1]).toEqual(["Aung Aung", "NRC-1", "Repeat"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
