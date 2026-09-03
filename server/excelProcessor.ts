import { buildWorkbookBase64, concatTables, previewTable, readSheet, readWorkbook, type Table } from "./xlsx/workbook.js";

export type ExcelInputFile = {
  name: string;
  data: string;
};

export type ExcelProcessingResult = {
  outputFilename: string;
  sheetNames: string[];
  fileCount: number;
  errors: string[];
  summary: { columns: string[]; rows: unknown[][] };
  addition: { columns: string[]; rows: unknown[][] };
  deletion: { columns: string[]; rows: unknown[][] };
  additionCount: number;
  deletionCount: number;
  workbookBase64: string;
};

function baseName(fileName: string): string {
  const withoutDir = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = withoutDir.lastIndexOf(".");
  return dot > 0 ? withoutDir.slice(0, dot) : withoutDir;
}

function withSourceFile(table: Table, source: string): Table {
  const columns = table.columns.includes("Source_File") ? table.columns : [...table.columns, "Source_File"];
  return {
    columns,
    rows: table.rows.map(row => ({ ...row, Source_File: source })),
  };
}

export function processExcelFiles(files: ExcelInputFile): Promise<ExcelProcessingResult>;
export function processExcelFiles(files: ExcelInputFile[]): Promise<ExcelProcessingResult>;
export function processExcelFiles(files: ExcelInputFile | ExcelInputFile[]): Promise<ExcelProcessingResult> {
  const normalized = Array.isArray(files) ? files : [files];
  return Promise.resolve().then(() => {
    const additionTables: Table[] = [];
    const deletionTables: Table[] = [];
    const summaryRows: Record<string, string | number>[] = [];
    const errors: string[] = [];

    for (const item of normalized) {
      const fileName = item.name || "uploaded.xlsx";
      if (!/\.(xlsx|xls)$/i.test(fileName)) {
        errors.push(`Skipped unsupported file: ${fileName}`);
        continue;
      }

      const rawName = baseName(fileName);
      let additionCount = 0;
      let deletionCount = 0;

      try {
        const workbook = readWorkbook(item.data);
        let additionSheet: string | null = null;
        let deletionSheet: string | null = null;
        for (const sheet of workbook.SheetNames) {
          const cleaned = sheet.trim().toLowerCase();
          if (cleaned.includes("addition") || cleaned.includes("add")) additionSheet = sheet;
          else if (cleaned.includes("deletion") || cleaned.includes("del")) deletionSheet = sheet;
        }

        if (additionSheet) {
          const table = withSourceFile(readSheet(workbook, additionSheet), rawName);
          additionTables.push(table);
          additionCount = table.rows.length;
        }
        if (deletionSheet) {
          const table = withSourceFile(readSheet(workbook, deletionSheet), rawName);
          deletionTables.push(table);
          deletionCount = table.rows.length;
        }

        summaryRows.push({
          "Excel File Name": fileName,
          "Addition Records": additionCount,
          "Deletion Records": deletionCount,
          "Total Records": additionCount + deletionCount,
        });
      } catch (error) {
        errors.push(`Error reading ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (summaryRows.length > 0 && additionTables.length === 0) errors.push("No Addition sheet found in the selected files");
    if (summaryRows.length > 0 && deletionTables.length === 0) errors.push("No Deletion sheet found in the selected files");

    const combinedAddition = additionTables.length > 0 ? concatTables(additionTables) : { columns: [], rows: [] };
    const combinedDeletion = deletionTables.length > 0 ? concatTables(deletionTables) : { columns: [], rows: [] };

    const fileCount = summaryRows.length;
    const summaryColumns = ["Excel File Name", "Addition Records", "Deletion Records", "Total Records"];
    const summaryTable: Table = { columns: summaryColumns, rows: summaryRows as unknown as Table["rows"] };
    if (summaryRows.length > 0) {
      summaryTable.rows.push({
        "Excel File Name": "TOTAL",
        "Addition Records": summaryRows.reduce((sum, row) => sum + Number(row["Addition Records"] ?? 0), 0),
        "Deletion Records": summaryRows.reduce((sum, row) => sum + Number(row["Deletion Records"] ?? 0), 0),
        "Total Records": summaryRows.reduce((sum, row) => sum + Number(row["Total Records"] ?? 0), 0),
      } as unknown as Table["rows"][number]);
    }

    const { base64, sheetNames } = buildWorkbookBase64([
      { name: "Summary Report", table: summaryTable },
      { name: "Addition", table: combinedAddition },
      { name: "Deletion", table: combinedDeletion },
    ]);

    return {
      outputFilename: "Master_Combined_With_Summary.xlsx",
      sheetNames,
      fileCount,
      errors,
      summary: previewTable(summaryTable, 100),
      addition: previewTable(combinedAddition, 8),
      deletion: previewTable(combinedDeletion, 8),
      additionCount: combinedAddition.rows.length,
      deletionCount: combinedDeletion.rows.length,
      workbookBase64: base64,
    };
  });
}
