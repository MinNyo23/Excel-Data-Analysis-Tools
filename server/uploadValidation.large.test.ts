import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_FILE_BYTES } from "../shared/uploadLimits";
import { validateUploadedWorkbook } from "./security";

describe("large workbook upload validation", () => {
  it("accepts a real multi-megabyte xlsx produced by SheetJS", () => {
    const rows: unknown[][] = [["Phone", "NRC", "Corporate Name", "Employee"]];
    for (let i = 0; i < 52_000; i += 1) {
      rows.push([
        `09${String(i).padStart(9, "0")}`,
        `12/${String(i).padStart(6, "0")}`,
        `Corp ${i % 500}`,
        `Name ${i}`,
      ]);
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Addition");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    expect(bytes.length).toBeGreaterThan(9 * 1024 * 1024);
    expect(bytes.length).toBeLessThanOrEqual(MAX_UPLOAD_FILE_BYTES);

    const error = validateUploadedWorkbook({
      name: "large-addition.xlsx",
      data: bytes.toString("base64"),
    });

    expect(error).toBeNull();
  }, 120_000);
});
