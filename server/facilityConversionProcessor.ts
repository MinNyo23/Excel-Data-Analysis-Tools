import { buildWorkbookBase64, previewTable, readFirstSheet, readWorkbook, type Row, type Table } from "./xlsx/workbook.js";

export type FacilityConversionResult = {
  outputFilename: string;
  facilityCount: number;
  recordCount: number;
  summary: { columns: string[]; rows: unknown[][] };
  facilitySheets: string[];
  workbookBase64: string;
};

export async function processFacilityConversion(file: { name: string; data: string }): Promise<FacilityConversionResult> {
  const table = readFirstSheet(readWorkbook(file.data)).table;
  if (!table.columns.includes("Entity Name")) throw new Error("Required column missing: Entity Name");

  // Mirror pandas `astype(str).str.strip()` so blank cells become the literal "nan".
  const normalizedRows: Row[] = table.rows.map(row => {
    const value = row["Entity Name"];
    const entity = value === null || value === undefined ? "nan" : String(value).trim();
    return { ...row, "Entity Name": entity };
  });
  const normalizedTable: Table = { columns: table.columns, rows: normalizedRows };

  const counts = new Map<string, number>();
  const appearanceOrder: string[] = [];
  for (const row of normalizedRows) {
    const entity = row["Entity Name"] as string;
    if (!counts.has(entity)) appearanceOrder.push(entity);
    counts.set(entity, (counts.get(entity) ?? 0) + 1);
  }

  const total = normalizedRows.length;
  const summaryRows: Row[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([entity, count]) => ({ "Entity Name": entity, "Total Count": count }));
  summaryRows.push({ "Entity Name": "GRAND TOTAL", "Total Count": total });
  const summaryTable: Table = { columns: ["Entity Name", "Total Count"], rows: summaryRows };

  const entitySheets = appearanceOrder.map(entity => ({
    name: entity,
    table: { columns: table.columns, rows: normalizedRows.filter(row => row["Entity Name"] === entity) } as Table,
  }));

  const { base64, sheetNames } = buildWorkbookBase64([
    { name: "Summary", table: summaryTable },
    { name: "All Data", table: normalizedTable },
    ...entitySheets,
  ]);

  const facilitySheets = sheetNames.slice(2);
  return {
    outputFilename: "Final_Entity_Report.xlsx",
    facilityCount: facilitySheets.length,
    recordCount: total,
    summary: previewTable(summaryTable),
    facilitySheets,
    workbookBase64: base64,
  };
}
