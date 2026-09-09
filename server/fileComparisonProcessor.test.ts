import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { processFileComparison } from "./fileComparisonProcessor";

function workbookBase64(rows: Record<string, string>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }).toString("base64");
}

describe("multi-condition file comparison", () => {
  it("flags File 1 rows that exist in File 2 using one condition", async () => {
    const file1 = workbookBase64([{ id: "A1", name: "Alpha" }, { id: "B2", name: "Beta" }]);
    const file2 = workbookBase64([{ code: "A1", label: "One" }, { code: "C3", label: "Three" }]);
    const result = await processFileComparison(
      { name: "file1.xlsx", data: file1 },
      { name: "file2.xlsx", data: file2 },
      { file1Column1: "id", file2Column1: "code", enableSecondCondition: false, operation: "exists_in_file2" },
    );

    expect(result.resultRowCount).toBe(2);
    expect(result.result.columns).toContain("Exists_in_File2");
    expect(result.result.rows[0]?.at(-1)).toBe("TRUE");
    expect(result.result.rows[1]?.at(-1)).toBe("FALSE");
  });

  it("matches duplicates across both files with a second condition", async () => {
    const file1 = workbookBase64([{ id: "A1", dept: "HR" }, { id: "A1", dept: "IT" }, { id: "B2", dept: "HR" }]);
    const file2 = workbookBase64([{ code: "A1", team: "HR" }, { code: "A1", team: "Finance" }, { code: "C3", team: "HR" }]);
    const result = await processFileComparison(
      { name: "file1.xlsx", data: file1 },
      { name: "file2.xlsx", data: file2 },
      {
        file1Column1: "id",
        file2Column1: "code",
        enableSecondCondition: true,
        file1Column2: "dept",
        file2Column2: "team",
        operation: "find_duplicates",
      },
    );

    expect(result.resultRowCount).toBe(1);
    expect(result.result.rows[0]?.[0]).toBe("A1");
    expect(result.result.rows[0]?.[1]).toBe("HR");
  });

  it("returns File 1 rows missing from File 2", async () => {
    const file1 = workbookBase64([{ id: "A1" }, { id: "B2" }, { id: "C3" }]);
    const file2 = workbookBase64([{ code: "A1" }, { code: "D4" }]);
    const result = await processFileComparison(
      { name: "file1.xlsx", data: file1 },
      { name: "file2.xlsx", data: file2 },
      { file1Column1: "id", file2Column1: "code", enableSecondCondition: false, operation: "missing_in_file2" },
    );

    expect(result.resultRowCount).toBe(2);
    expect(result.result.rows.map(row => row[0])).toEqual(["B2", "C3"]);
  });
});
