import { buildWorkbookBase64, previewTable, readFirstSheet, readWorkbook, type CellValue, type Preview, type Row, type Table } from "./xlsx/workbook.js";

export type FileComparisonOperation = "exists_in_file2" | "find_duplicates" | "missing_in_file2";

export type FileComparisonConfig = {
  file1Column1: string;
  file2Column1: string;
  enableSecondCondition: boolean;
  file1Column2?: string;
  file2Column2?: string;
  operation: FileComparisonOperation;
};

export type FileComparisonResult = {
  outputFilename: string;
  operation: FileComparisonOperation;
  operationLabel: string;
  file1RowCount: number;
  resultRowCount: number;
  summary: Preview;
  result: Preview;
  workbookBase64: string;
};

const OPERATION_LABELS: Record<FileComparisonOperation, string> = {
  exists_in_file2: "Exists in File 2",
  find_duplicates: "Duplicates Across Files",
  missing_in_file2: "Missing in File 2",
};

const OPERATION_SHEET_NAMES: Record<FileComparisonOperation, string> = {
  exists_in_file2: "Exists in File 2",
  find_duplicates: "Duplicates Across Files",
  missing_in_file2: "Missing in File 2",
};

function stripKey(value: CellValue): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function requireColumn(table: Table, column: string, label: string): void {
  if (!table.columns.includes(column)) throw new Error(`Selected ${label} column was not found: ${column}`);
}

function buildCompositeKey(row: Row, column1: string, column2?: string): string {
  const first = stripKey(row[column1]);
  if (!column2) return first;
  return `${first}___${stripKey(row[column2])}`;
}

function buildLookupKeys(table: Table, column1: string, column2?: string): Set<string> {
  const keys = new Set<string>();
  for (const row of table.rows) {
    const key = buildCompositeKey(row, column1, column2);
    if (key) keys.add(key);
  }
  return keys;
}

function summaryTable(config: FileComparisonConfig, file1Name: string, file2Name: string, file1RowCount: number, resultRowCount: number): Table {
  const rows: Row[] = [
    { Metric: "Operation", Value: OPERATION_LABELS[config.operation] },
    { Metric: "File 1", Value: file1Name },
    { Metric: "File 2", Value: file2Name },
    { Metric: "File 1 Column 1", Value: config.file1Column1 },
    { Metric: "File 2 Column 1", Value: config.file2Column1 },
    { Metric: "Second condition enabled", Value: config.enableSecondCondition ? "Yes" : "No" },
  ];
  if (config.enableSecondCondition) {
    rows.push({ Metric: "File 1 Column 2", Value: config.file1Column2 ?? "" });
    rows.push({ Metric: "File 2 Column 2", Value: config.file2Column2 ?? "" });
  }
  rows.push({ Metric: "File 1 rows", Value: file1RowCount });
  rows.push({ Metric: "Result rows", Value: resultRowCount });
  return { columns: ["Metric", "Value"], rows };
}

export async function processFileComparison(
  file1: { name: string; data: string },
  file2: { name: string; data: string },
  config: FileComparisonConfig,
): Promise<FileComparisonResult> {
  const file1Table = readFirstSheet(readWorkbook(file1.data), { asString: true }).table;
  const file2Table = readFirstSheet(readWorkbook(file2.data), { asString: true }).table;

  requireColumn(file1Table, config.file1Column1, "File 1 column 1");
  requireColumn(file2Table, config.file2Column1, "File 2 column 1");
  if (config.enableSecondCondition) {
    if (!config.file1Column2 || !config.file2Column2) throw new Error("Both second-condition columns must be selected.");
    requireColumn(file1Table, config.file1Column2, "File 1 column 2");
    requireColumn(file2Table, config.file2Column2, "File 2 column 2");
  }

  const file2Keys = buildLookupKeys(
    file2Table,
    config.file2Column1,
    config.enableSecondCondition ? config.file2Column2 : undefined,
  );

  const file1Keys = file1Table.rows.map(row =>
    buildCompositeKey(row, config.file1Column1, config.enableSecondCondition ? config.file1Column2 : undefined),
  );

  let resultTable: Table;

  if (config.operation === "exists_in_file2") {
    const columns = [...file1Table.columns, "Exists_in_File2"];
    const rows = file1Table.rows.map((row, index) => ({
      ...row,
      Exists_in_File2: file1Keys[index] !== "" && file2Keys.has(file1Keys[index]) ? "TRUE" : "FALSE",
    }));
    resultTable = { columns, rows };
  } else if (config.operation === "find_duplicates") {
    const commonKeys = new Set(file1Keys.filter(key => key !== "" && file2Keys.has(key)));
    resultTable = {
      columns: [...file1Table.columns],
      rows: file1Table.rows.filter((_, index) => commonKeys.has(file1Keys[index] ?? "")),
    };
  } else {
    resultTable = {
      columns: [...file1Table.columns],
      rows: file1Table.rows.filter((_, index) => {
        const key = file1Keys[index] ?? "";
        return key === "" || !file2Keys.has(key);
      }),
    };
  }

  const summary = summaryTable(config, file1.name, file2.name, file1Table.rows.length, resultTable.rows.length);
  const { base64 } = buildWorkbookBase64([
    { name: "Summary Report", table: summary },
    { name: OPERATION_SHEET_NAMES[config.operation], table: resultTable },
  ]);

  return {
    outputFilename: "Multi_Condition_File_Comparison.xlsx",
    operation: config.operation,
    operationLabel: OPERATION_LABELS[config.operation],
    file1RowCount: file1Table.rows.length,
    resultRowCount: resultTable.rows.length,
    summary: previewTable(summary),
    result: previewTable(resultTable),
    workbookBase64: base64,
  };
}
