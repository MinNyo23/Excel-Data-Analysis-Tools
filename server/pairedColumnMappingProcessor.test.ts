import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { processAdditionExitMatch } from "./additionExitMatchProcessor";

describe("paired column mapping", () => {
  it("uses explicitly confirmed matching columns without changing the expected report groups", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "mapped-match-"));
    try {
      const originalPath = path.join(directory, "original.xlsx");
      const secondPath = path.join(directory, "second.xlsx");
      const fixture = path.resolve(process.cwd(), "scripts/create_addition_match_fixture.py");
      execFileSync("python3", [fixture, "original", originalPath]);
      execFileSync("python3", [fixture, "exit", secondPath]);
      const result: any = await processAdditionExitMatch(
        { name: "original.xlsx", data: readFileSync(originalPath).toString("base64") },
        { name: "second.xlsx", data: readFileSync(secondPath).toString("base64") },
        { originalPhone: "mobile_number", originalNrc: "identity_number", originalCorporateName: "corporate_name", secondPhone: "Mobile No", secondNrc: "NRC No" },
      );
      expect(result.summary.rows.map((row: any[]) => row[1])).toEqual([1, 1, 1, 1, 4]);
      expect(result.groups["Both Mobile & NRC Matched"].rows[0]).toContain("Original Mobile");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("rejects a requested column that is not present in the file", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "invalid-mapped-match-"));
    try {
      const originalPath = path.join(directory, "original.xlsx");
      const secondPath = path.join(directory, "second.xlsx");
      const fixture = path.resolve(process.cwd(), "scripts/create_addition_match_fixture.py");
      execFileSync("python3", [fixture, "original", originalPath]);
      execFileSync("python3", [fixture, "exit", secondPath]);
      await expect(processAdditionExitMatch({ name: "original.xlsx", data: readFileSync(originalPath).toString("base64") }, { name: "second.xlsx", data: readFileSync(secondPath).toString("base64") }, { originalPhone: "Not a real column" })).rejects.toThrow("Selected original Phone column was not found");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
