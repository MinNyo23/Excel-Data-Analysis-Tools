import { buildWorkbookBase64, type CellValue, previewTable, readFirstSheet, readWorkbook, type Row, type Table } from "./xlsx/workbook.js";

type PairMapping = { originalPhone?: string; originalNrc?: string; originalCorporateName?: string; secondPhone?: string; secondNrc?: string };

export type MatchGroupPreview = { columns: string[]; rows: unknown[][] };
export type AdditionExitMatchResult = {
  outputFilename: string;
  summary: MatchGroupPreview;
  groups: Record<string, MatchGroupPreview>;
  workbookBase64: string;
};

function normKey(value: CellValue): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[^a-zA-Z0-9]/g, "").toLowerCase().trim();
}

function selectedColumn(table: Table, requested: string | undefined, fallback: string, label: string, required = false): string | null {
  const column = requested || fallback;
  if (column && table.columns.includes(column)) return column;
  if (requested) throw new Error(`Selected ${label} column was not found: ${requested}`);
  if (required) throw new Error(`Required ${label} column missing: ${fallback}`);
  return null;
}

function ensureColumns(table: Table, required: string[]): void {
  for (const column of required) {
    if (!table.columns.includes(column)) {
      table.columns.push(column);
      for (const row of table.rows) row[column] = "";
    }
  }
}

export async function processAdditionExitMatch(
  original: { name: string; data: string },
  exit: { name: string; data: string },
  mapping?: PairMapping,
): Promise<AdditionExitMatchResult> {
  const originalTable = readFirstSheet(readWorkbook(original.data), { asString: true }).table;
  const exitTable = readFirstSheet(readWorkbook(exit.data), { asString: true }).table;
  const map = mapping ?? {};

  const originalPhone = selectedColumn(originalTable, map.originalPhone, "mobile_number", "original Phone");
  const originalNrc = selectedColumn(originalTable, map.originalNrc, "identity_number", "original NRC");
  const originalCorporate = selectedColumn(originalTable, map.originalCorporateName, "corporate_name", "original Corporate Name");
  const exitPhone = selectedColumn(exitTable, map.secondPhone, "Mobile No", "2nd File Phone", true)!;
  const exitNrc = selectedColumn(exitTable, map.secondNrc, "NRC No", "2nd File NRC", true)!;

  ensureColumns(originalTable, ["hospital_registration_number", "fullname", "date_of_birth"]);

  const mobileMatches = new Map<string, Row>();
  const nrcMatches = new Map<string, Row>();
  for (const row of originalTable.rows) {
    const mKey = originalPhone ? normKey(row[originalPhone]) : "";
    const nKey = originalNrc ? normKey(row[originalNrc]) : "";
    if (mKey && !mobileMatches.has(mKey)) mobileMatches.set(mKey, row);
    if (nKey && !nrcMatches.has(nKey)) nrcMatches.set(nKey, row);
  }

  const matchColumns: Array<[string, string | null]> = [
    ["hospital_registration_number", "hospital_registration_number"],
    ["corporate_name", originalCorporate],
    ["fullname", "fullname"],
    ["date_of_birth", "date_of_birth"],
  ];

  const matchedColumnNames = matchColumns.map(([output]) => `Matched_${output}`);
  const outputColumns = [...exitTable.columns, ...matchedColumnNames];

  const bothRows: Row[] = [];
  const mobileOnlyRows: Row[] = [];
  const nrcOnlyRows: Row[] = [];
  const noMatchRows: Row[] = [];

  for (const row of exitTable.rows) {
    const mKey = normKey(row[exitPhone]);
    const nKey = normKey(row[exitNrc]);
    const mobileHit = mKey !== "" && mobileMatches.has(mKey);
    const nrcHit = nKey !== "" && nrcMatches.has(nKey);

    const enriched: Row = { ...row };
    for (const [output, source] of matchColumns) {
      let value: CellValue = "";
      if (source) {
        if (mobileHit) value = mobileMatches.get(mKey)![source] ?? "";
        else if (nrcHit) value = nrcMatches.get(nKey)![source] ?? "";
      }
      enriched[`Matched_${output}`] = value;
    }

    if (mobileHit && nrcHit) bothRows.push(enriched);
    else if (mobileHit && !nrcHit) mobileOnlyRows.push(enriched);
    else if (!mobileHit && nrcHit) nrcOnlyRows.push(enriched);
    else noMatchRows.push(enriched);
  }

  const groups: Record<string, Table> = {
    "Both Mobile & NRC Matched": { columns: outputColumns, rows: bothRows },
    "Only Mobile Matched": { columns: outputColumns, rows: mobileOnlyRows },
    "Only NRC Matched": { columns: outputColumns, rows: nrcOnlyRows },
    "New Records (No Match)": { columns: outputColumns, rows: noMatchRows },
  };

  const summaryRows: Row[] = [
    ...Object.entries(groups).map(([category, table]) => ({ Category: category, "Total Records": table.rows.length })),
    { Category: "GRAND TOTAL (File 2 Size)", "Total Records": exitTable.rows.length },
  ];
  const summaryTable: Table = { columns: ["Category", "Total Records"], rows: summaryRows };

  const { base64 } = buildWorkbookBase64([
    { name: "Summary Report", table: summaryTable },
    ...Object.entries(groups).map(([name, table]) => ({ name, table })),
  ]);

  return {
    outputFilename: "Data_Validation_Match_Report.xlsx",
    summary: previewTable(summaryTable),
    groups: Object.fromEntries(Object.entries(groups).map(([name, table]) => [name, previewTable(table)])),
    workbookBase64: base64,
  };
}
