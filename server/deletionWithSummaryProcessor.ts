import { buildWorkbookBase64, previewTable, readSheet, readWorkbook, type Row, type Table } from "./xlsx/workbook.js";

export type DeletionWithSummaryResult = {
  outputFilename: string;
  sheetNames: string[];
  sourceSheetCount: number;
  entityCount: number;
  summary: { columns: string[]; rows: unknown[][] };
  workbookBase64: string;
};

function simplify(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function entityColumn(table: Table): string | null {
  return table.columns.find(column => simplify(column) === "entityname" || simplify(column).includes("entity")) ?? null;
}

export async function processDeletionWithSummary(file: { name: string; data: string }): Promise<DeletionWithSummaryResult> {
  const workbook = readWorkbook(file.data);
  const sourceSheets = workbook.SheetNames;

  const frames = new Map<string, Table>();
  const countsBySheet = new Map<string, Map<string, number>>();
  const entities = new Set<string>();

  for (const sheet of sourceSheets) {
    const table = readSheet(workbook, sheet);
    frames.set(sheet, table);
    const column = entityColumn(table);
    const counts = new Map<string, number>();
    if (column && table.rows.length > 0) {
      for (const row of table.rows) {
        const value = row[column];
        if (value === null || value === undefined || value === "") continue;
        const entity = String(value).trim();
        if (!entity) continue;
        counts.set(entity, (counts.get(entity) ?? 0) + 1);
        entities.add(entity);
      }
    }
    countsBySheet.set(sheet, counts);
  }

  const columns = ["Sr No", "Entity Name", ...sourceSheets.map(sheet => `${sheet} Count`), "Grand Total"];
  const summaryRows: Row[] = [];
  Array.from(entities).sort((a, b) => a.localeCompare(b)).forEach((entity, index) => {
    const row: Row = { "Sr No": index + 1, "Entity Name": entity };
    let total = 0;
    for (const sheet of sourceSheets) {
      const count = countsBySheet.get(sheet)?.get(entity) ?? 0;
      row[`${sheet} Count`] = count;
      total += count;
    }
    row["Grand Total"] = total;
    summaryRows.push(row);
  });

  if (summaryRows.length > 0) {
    const totalRow: Row = { "Sr No": "", "Entity Name": "TOTAL" };
    for (const sheet of sourceSheets) {
      totalRow[`${sheet} Count`] = summaryRows.reduce((sum, row) => sum + Number(row[`${sheet} Count`] ?? 0), 0);
    }
    totalRow["Grand Total"] = summaryRows.reduce((sum, row) => sum + Number(row["Grand Total"] ?? 0), 0);
    summaryRows.push(totalRow);
  }

  const summaryTable: Table = { columns, rows: summaryRows };

  const { base64, sheetNames } = buildWorkbookBase64([
    { name: "Entity Summary", table: summaryTable },
    ...sourceSheets.map(sheet => ({ name: sheet, table: frames.get(sheet)! })),
  ]);

  return {
    outputFilename: "Entity_Summary_Final_Report.xlsx",
    sheetNames,
    sourceSheetCount: sourceSheets.length,
    entityCount: entities.size,
    summary: previewTable(summaryTable),
    workbookBase64: base64,
  };
}
