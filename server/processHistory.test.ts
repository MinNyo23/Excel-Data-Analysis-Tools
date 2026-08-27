import { describe, expect, it } from "vitest";
import { processHistoryInputSchema } from "./routers";

describe("process history privacy schema", () => {
  const safeMetadata = {
    toolKey: "consolidation",
    toolName: "Master consolidation",
    inputFileNames: ["addition.xlsx", "deletion.xlsx"],
    outputFilename: "Master_Combined_With_Summary.xlsx",
    totalRecords: 42,
  };

  it("accepts metadata-only completed process records", () => {
    expect(processHistoryInputSchema.parse(safeMetadata)).toEqual(safeMetadata);
  });

  it("rejects workbook bytes, preview rows, and spreadsheet contents", () => {
    expect(() => processHistoryInputSchema.parse({ ...safeMetadata, workbookBase64: "sensitive-workbook-bytes" })).toThrow();
    expect(() => processHistoryInputSchema.parse({ ...safeMetadata, preview: { columns: ["NRC"], rows: [["12/ABC(N)123456"]] } })).toThrow();
    expect(() => processHistoryInputSchema.parse({ ...safeMetadata, spreadsheetData: "employee row content" })).toThrow();
  });
});
