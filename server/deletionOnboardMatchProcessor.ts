import { buildWorkbookBase64, type CellValue, previewTable, readFirstSheet, readWorkbook, type Row, type Table } from "./xlsx/workbook.js";

type PairMapping = { originalPhone?: string; originalNrc?: string; originalCorporateName?: string; secondPhone?: string; secondNrc?: string };

export type OnboardMatchGroupPreview = { columns: string[]; rows: unknown[][] };
export type DeletionOnboardMatchResult = {
  outputFilename: string;
  summary: OnboardMatchGroupPreview;
  matched: OnboardMatchGroupPreview;
  noMatch: OnboardMatchGroupPreview;
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

export async function processDeletionOnboardMatch(
  onboard: { name: string; data: string },
  deletion: { name: string; data: string },
  mapping?: PairMapping,
): Promise<DeletionOnboardMatchResult> {
  const onboardTable = readFirstSheet(readWorkbook(onboard.data), { asString: true }).table;
  const deletionTable = readFirstSheet(readWorkbook(deletion.data), { asString: true }).table;
  const map = mapping ?? {};

  const onboardNrc = selectedColumn(onboardTable, map.originalNrc, "identity_number", "original NRC");
  const onboardCorporate = selectedColumn(onboardTable, map.originalCorporateName, "corporate_name", "original Corporate Name");
  const deletionNrc = selectedColumn(deletionTable, map.secondNrc, "NRC No", "2nd File NRC", true)!;

  if (!onboardTable.columns.includes("hospital_registration_number")) {
    onboardTable.columns.push("hospital_registration_number");
    for (const row of onboardTable.rows) row["hospital_registration_number"] = "";
  }

  const matches = new Map<string, Row>();
  if (onboardNrc) {
    for (const row of onboardTable.rows) {
      const key = normKey(row[onboardNrc]);
      if (key && !matches.has(key)) matches.set(key, row);
    }
  }

  const outputColumns = [...deletionTable.columns, "Matched_hospital_registration_number", "Matched_corporate_name"];
  const matchedRows: Row[] = [];
  const noMatchRows: Row[] = [];

  for (const row of deletionTable.rows) {
    const key = normKey(row[deletionNrc]);
    const hit = key !== "" && matches.has(key);
    const enriched: Row = { ...row };
    enriched["Matched_hospital_registration_number"] = hit ? matches.get(key)!["hospital_registration_number"] ?? null : null;
    enriched["Matched_corporate_name"] = onboardCorporate ? (hit ? matches.get(key)![onboardCorporate] ?? null : null) : "";
    if (hit) matchedRows.push(enriched);
    else noMatchRows.push(enriched);
  }

  const matchedTable: Table = { columns: outputColumns, rows: matchedRows };
  const noMatchTable: Table = { columns: outputColumns, rows: noMatchRows };
  const summaryTable: Table = {
    columns: ["Category", "Total Records"],
    rows: [
      { Category: "Matched List (NRC Found)", "Total Records": matchedRows.length },
      { Category: "No Match List (NRC Not Found)", "Total Records": noMatchRows.length },
      { Category: "GRAND TOTAL (File 2 Size)", "Total Records": deletionTable.rows.length },
    ],
  };

  const { base64 } = buildWorkbookBase64([
    { name: "Summary Report", table: summaryTable },
    { name: "Matched List", table: matchedTable },
    { name: "No Match List", table: noMatchTable },
  ]);

  return {
    outputFilename: "NRC_Match_Report.xlsx",
    summary: previewTable(summaryTable),
    matched: previewTable(matchedTable),
    noMatch: previewTable(noMatchTable),
    workbookBase64: base64,
  };
}
