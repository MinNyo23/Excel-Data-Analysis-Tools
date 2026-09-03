import { readHeaderColumns } from "./xlsx/workbook.js";

export type WorkbookColumnInspection = { sheetName: string; columns: string[] };

export async function inspectWorkbookColumns(file: { name: string; data: string }): Promise<WorkbookColumnInspection> {
  return readHeaderColumns(file.data);
}
