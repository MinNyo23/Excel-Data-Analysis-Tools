import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { processColumnTransform } from "./columnTransformProcessor";

function workbookBase64(rows: Record<string, string | number>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }).toString("base64");
}

describe("column transform processor", () => {
  it("cleans spaces and prefixes text on the first option", async () => {
    const data = workbookBase64([
      { Name: "  Aye   Aye\n", Code: "A1" },
      { Name: "Min  Nyo", Code: "B2" },
    ]);
    const result = await processColumnTransform(
      { name: "source.xlsx", data },
      {
        option1: { column: "Name", operation: "clean_spaces" },
        enableSecondOption: true,
        option2: { column: "Name", operation: "add_text_front", param: "EMP-" },
      },
    );

    expect(result.rowCount).toBe(2);
    expect(result.preview.rows[0]?.[0]).toBe("EMP-Aye Aye");
    expect(result.operationsApplied).toEqual(["Clean spaces on Name", "Add text in front on Name"]);
  });

  it("removes duplicate rows and flags remaining duplicates on a second column", async () => {
    const data = workbookBase64([
      { Name: "Aung", Team: "HR" },
      { Name: "Aung", Team: "HR" },
      { Name: "Aye", Team: "HR" },
      { Name: "Min", Team: "IT" },
    ]);
    const result = await processColumnTransform(
      { name: "source.xlsx", data },
      {
        option1: { column: "Name", operation: "remove_duplicates" },
        enableSecondOption: true,
        option2: { column: "Team", operation: "flag_duplicates" },
      },
    );

    expect(result.rowCount).toBe(3);
    expect(result.preview.columns).toContain("Team_Is_Duplicate");
    expect(result.preview.rows[0]?.[2]).toBe("TRUE");
    expect(result.preview.rows[2]?.[2]).toBe("FALSE");
  });

  it("formats mixed dates as YYYY-MM-DD", async () => {
    const data = workbookBase64([
      { Start: "31/12/1990" },
      { Start: "1991-01-02" },
    ]);
    const result = await processColumnTransform(
      { name: "source.xlsx", data },
      {
        option1: { column: "Start", operation: "standardize_date" },
        enableSecondOption: false,
      },
    );

    expect(result.preview.rows[0]?.[0]).toBe("1990-12-31");
    expect(result.preview.rows[1]?.[0]).toBe("1991-01-02");
  });
});
