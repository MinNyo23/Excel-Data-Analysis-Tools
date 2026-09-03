import { buildWorkbookBase64, previewTable, readFirstSheet, readWorkbook, type Row, type Table } from "./xlsx/workbook.js";

export type DeletionDuplicatesInput = { name: string; data: string };
export type DeletionDuplicatesResult = {
  outputFilename: string;
  sheetNames: string[];
  sourceFilename: string;
  sourceSheet: string;
  nameColumn: string;
  nrcColumn: string;
  originalCount: number;
  cleanCount: number;
  duplicateCount: number;
  cleanData: { columns: string[]; rows: unknown[][] };
  duplicates: { columns: string[]; rows: unknown[][] };
  workbookBase64: string;
};

function simplify(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function keyOf(value: Row[string]): string {
  return value === null || value === undefined ? "\u0000<NA>" : `v:${String(value)}`;
}

export async function processDeletionDuplicates(file: DeletionDuplicatesInput): Promise<DeletionDuplicatesResult> {
  const workbook = readWorkbook(file.data);
  if (workbook.SheetNames.length === 0) throw new Error("The workbook does not contain any sheets.");
  const { sheetName, table } = readFirstSheet(workbook);

  let nameColumn: string | null = null;
  let nrcColumn: string | null = null;
  for (const column of table.columns) {
    const cleaned = simplify(column);
    if (cleaned.includes("fullname") || cleaned.includes("employeename") || cleaned === "employeefullname") nameColumn = column;
    else if (cleaned.includes("nrc") || cleaned.includes("nrcno")) nrcColumn = column;
  }
  if (!nameColumn && table.columns.includes("Employee Full Name")) nameColumn = "Employee Full Name";
  if (!nrcColumn && table.columns.includes("NRC No")) nrcColumn = "NRC No";
  if (!nameColumn || !nrcColumn) {
    throw new Error(`Could not find required columns. Detected columns: ${JSON.stringify(table.columns)}`);
  }

  const seen = new Set<string>();
  const cleanRows: Row[] = [];
  const duplicateRows: Row[] = [];
  for (const row of table.rows) {
    const key = `${keyOf(row[nameColumn])}|${keyOf(row[nrcColumn])}`;
    if (seen.has(key)) duplicateRows.push(row);
    else {
      seen.add(key);
      cleanRows.push(row);
    }
  }

  const cleanTable: Table = { columns: table.columns, rows: cleanRows };
  const duplicatesTable: Table = { columns: table.columns, rows: duplicateRows };

  const { base64, sheetNames } = buildWorkbookBase64([
    { name: "Clean Data", table: cleanTable },
    { name: "Duplicates Moved", table: duplicatesTable },
  ]);

  return {
    outputFilename: "Processed_Duplicates_Moved.xlsx",
    sheetNames,
    sourceFilename: file.name,
    sourceSheet: sheetName,
    nameColumn,
    nrcColumn,
    originalCount: table.rows.length,
    cleanCount: cleanRows.length,
    duplicateCount: duplicateRows.length,
    cleanData: previewTable(cleanTable),
    duplicates: previewTable(duplicatesTable),
    workbookBase64: base64,
  };
}
