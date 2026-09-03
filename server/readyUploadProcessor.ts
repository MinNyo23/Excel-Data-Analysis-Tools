import { buildWorkbookBase64, type CellValue, previewTable, readFirstSheet, readWorkbook, type Row, type Table } from "./xlsx/workbook.js";

export type ReadyUploadResult = {
  outputFilename: string;
  rowCount: number;
  columnCount: number;
  preview: { columns: string[]; rows: unknown[][] };
  workbookBase64: string;
};

const RENAME: Record<string, string> = {
  "Employee Full Name": "Name",
  "Employee ID": "Employee Registration Number",
  "Mobile No": "Mobile Number",
  "NRC No": "IdentityNumber",
  "Father Name": "Contact Person",
};
const BLANK = ["Title", "Mobile Country Code", "Marital Status", "Identity Type", "Contact Number", "Country", "State", "City", "Township"];
const ORDER = [
  "Title", "Name", "Email", "Employee Registration Number", "Mobile Country Code", "Mobile Number", "Date of Birth",
  "Gender", "Marital Status", "Identity Type", "IdentityNumber", "Contact Person", "Contact Number", "Country",
  "Nationality", "State", "City", "Township", "Address",
];

/** Day-first tolerant date parser mirroring pandas `to_datetime(format="mixed", dayfirst=True)`. */
function parseDayFirst(value: CellValue): Date | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(?:[ T].*)?$/);
  if (!match) {
    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null : new Date(Date.UTC(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()));
  }
  let [, a, b, c] = match;
  let year: number, month: number, day: number;
  if (a.length === 4) {
    year = Number(a); month = Number(b); day = Number(c);
  } else {
    day = Number(a); month = Number(b); year = Number(c);
    if (c.length <= 2) year += year >= 70 ? 1900 : 2000;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function processReadyUpload(file: { name: string; data: string }): Promise<ReadyUploadResult> {
  const source = readFirstSheet(readWorkbook(file.data), { asString: true }).table;

  const renamedColumns = source.columns.map(column => RENAME[column] ?? column);
  const rows: Row[] = source.rows.map(row => {
    const renamed: Row = {};
    source.columns.forEach((column, index) => {
      renamed[renamedColumns[index]!] = row[column] ?? null;
    });
    return renamed;
  });

  const columnSet = new Set(renamedColumns);

  if (columnSet.has("Date of Birth")) {
    for (const row of rows) row["Date of Birth"] = parseDayFirst(row["Date of Birth"]) as unknown as CellValue;
  }
  for (const column of BLANK) {
    columnSet.add(column);
    for (const row of rows) row[column] = "";
  }

  const outputColumns = ORDER.filter(column => columnSet.has(column));
  const projectedRows: Row[] = rows.map(row => {
    const projected: Row = {};
    for (const column of outputColumns) projected[column] = row[column] ?? null;
    return projected;
  });
  const table: Table = { columns: outputColumns, rows: projectedRows };

  const { base64 } = buildWorkbookBase64([
    { name: "Sheet1", table, columnFormats: { "Date of Birth": "mm/dd/yyyy" } },
  ]);

  return {
    outputFilename: "Transformed_Employee_Data.xlsx",
    rowCount: projectedRows.length,
    columnCount: outputColumns.length,
    preview: previewTable(table),
    workbookBase64: base64,
  };
}
