import { buildWorkbookBase64, previewTable, readSheet, readWorkbook, type Table } from "./xlsx/workbook.js";

export type DeletionSummaryInput = { name: string; data: string };
export type DeletionSummaryResult = {
  outputFilename: string;
  sheetNames: string[];
  sourceFilename: string;
  sourceSheet: string;
  entityColumn: string;
  uniqueEntityCount: number;
  deletionRowCount: number;
  summary: { columns: string[]; rows: unknown[][] };
  deletionData: { columns: string[]; rows: unknown[][] };
  workbookBase64: string;
};

function simplify(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/** Counts values in first-appearance-stable, count-descending order (pandas value_counts). */
export function valueCounts(values: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export async function processDeletionSummary(file: DeletionSummaryInput): Promise<DeletionSummaryResult> {
  const workbook = readWorkbook(file.data);
  const names = workbook.SheetNames;
  if (names.length === 0) throw new Error("The workbook does not contain any sheets.");
  const deletionSheet = names.find(sheet => simplify(sheet).includes("deletion") || simplify(sheet).includes("del")) ?? names[0]!;

  const deletionData = readSheet(workbook, deletionSheet);
  const entityColumn =
    deletionData.columns.find(column => simplify(column) === "entityname" || simplify(column).includes("entity")) ?? null;
  if (!entityColumn) throw new Error("'Entity Name' column not found in the selected sheet.");

  const entityValues = deletionData.rows
    .map(row => row[entityColumn])
    .filter((value): value is string | number | boolean => value !== null && value !== undefined && value !== "")
    .map(value => String(value).trim())
    .filter(Boolean);

  const counts = valueCounts(entityValues);
  const summaryRows = counts.map(([entity, count], index) => ({
    "Sr No": index + 1 as number | string,
    "Entity Name": entity,
    "Total Deletion Count": count as number | string,
  }));
  if (summaryRows.length > 0) {
    summaryRows.push({
      "Sr No": "",
      "Entity Name": "TOTAL",
      "Total Deletion Count": counts.reduce((sum, [, count]) => sum + count, 0),
    });
  }
  const summaryTable: Table = {
    columns: ["Sr No", "Entity Name", "Total Deletion Count"],
    rows: summaryRows as unknown as Table["rows"],
  };

  const { base64, sheetNames } = buildWorkbookBase64([
    { name: "Deletion Entity Summary", table: summaryTable },
    { name: "Deletion Data", table: deletionData },
  ]);

  return {
    outputFilename: "Deletion_Entity_Summary_Report.xlsx",
    sheetNames,
    sourceFilename: file.name,
    sourceSheet: deletionSheet,
    entityColumn,
    uniqueEntityCount: counts.length,
    deletionRowCount: deletionData.rows.length,
    summary: previewTable(summaryTable),
    deletionData: previewTable(deletionData),
    workbookBase64: base64,
  };
}
