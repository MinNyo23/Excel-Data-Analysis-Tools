import { buildWorkbookBase64, type CellValue, previewTable, readFirstSheet, readWorkbook, type Table } from "./xlsx/workbook.js";

export const COLUMN_TRANSFORM_OPERATIONS = [
  "none",
  "clean_spaces",
  "remove_duplicates",
  "flag_duplicates",
  "add_text_front",
  "add_text_end",
  "add_number_front",
  "delete_text",
  "change_case",
  "standardize_date",
] as const;

export type ColumnTransformOperation = (typeof COLUMN_TRANSFORM_OPERATIONS)[number];
export type ColumnTransformCase = "Proper Case" | "UPPERCASE" | "lowercase";

export type ColumnTransformStep = {
  column: string;
  operation: ColumnTransformOperation;
  param?: string;
  caseType?: ColumnTransformCase;
};

export type ColumnTransformConfig = {
  option1: ColumnTransformStep;
  enableSecondOption: boolean;
  option2?: ColumnTransformStep;
};

export type ColumnTransformResult = {
  outputFilename: string;
  sourceFilename: string;
  rowCount: number;
  columnCount: number;
  operationsApplied: string[];
  preview: { columns: string[]; rows: unknown[][] };
  workbookBase64: string;
};

const OPERATION_LABELS: Record<ColumnTransformOperation, string> = {
  none: "None",
  clean_spaces: "Clean spaces",
  remove_duplicates: "Remove duplicate rows",
  flag_duplicates: "Flag duplicates",
  add_text_front: "Add text in front",
  add_text_end: "Add text to end",
  add_number_front: "Add serial number",
  delete_text: "Delete text",
  change_case: "Change text case",
  standardize_date: "Format as date",
};

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function parseFlexibleDate(value: CellValue): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(?:[ T].*)?$/);
  if (!match) {
    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const first = match[1] ?? "";
  const second = match[2] ?? "";
  const third = match[3] ?? "";
  let year: number;
  let month: number;
  let day: number;
  if (first.length === 4) {
    year = Number(first);
    month = Number(second);
    day = Number(third);
  } else {
    day = Number(first);
    month = Number(second);
    year = Number(third);
    if (third.length <= 2) year += year >= 70 ? 1900 : 2000;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoDate(value: CellValue): string {
  const date = parseFlexibleDate(value);
  if (!date) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cloneTable(table: Table): Table {
  return {
    columns: [...table.columns],
    rows: table.rows.map(row => ({ ...row })),
  };
}

function applyStep(table: Table, step: ColumnTransformStep | undefined): string | null {
  if (!step || step.operation === "none" || !step.column) return null;
  if (!table.columns.includes(step.column)) {
    throw new Error(`Column "${step.column}" was not found in the uploaded workbook.`);
  }

  const column = step.column;
  const param = step.param ?? "";

  if (step.operation === "clean_spaces") {
    for (const row of table.rows) {
      row[column] = cellText(row[column]).replace(/\s+/g, " ").trim();
    }
  } else if (step.operation === "remove_duplicates") {
    const seen = new Set<string>();
    table.rows = table.rows.filter(row => {
      const key = cellText(row[column]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else if (step.operation === "flag_duplicates") {
    const counts = new Map<string, number>();
    for (const row of table.rows) {
      const key = cellText(row[column]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const flagColumn = `${column}_Is_Duplicate`;
    if (!table.columns.includes(flagColumn)) table.columns.push(flagColumn);
    for (const row of table.rows) {
      row[flagColumn] = (counts.get(cellText(row[column])) ?? 0) > 1 ? "TRUE" : "FALSE";
    }
  } else if (step.operation === "add_text_front") {
    for (const row of table.rows) row[column] = `${param}${cellText(row[column])}`;
  } else if (step.operation === "add_text_end") {
    for (const row of table.rows) row[column] = `${cellText(row[column])}${param}`;
  } else if (step.operation === "add_number_front") {
    table.rows.forEach((row, index) => {
      row[column] = `${index + 1}_${cellText(row[column])}`;
    });
  } else if (step.operation === "delete_text") {
    for (const row of table.rows) {
      row[column] = param ? cellText(row[column]).split(param).join("") : cellText(row[column]);
    }
  } else if (step.operation === "change_case") {
    for (const row of table.rows) {
      const text = cellText(row[column]);
      if (step.caseType === "UPPERCASE") row[column] = text.toUpperCase();
      else if (step.caseType === "lowercase") row[column] = text.toLowerCase();
      else row[column] = text.replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    }
  } else if (step.operation === "standardize_date") {
    for (const row of table.rows) row[column] = formatIsoDate(row[column]);
  }

  return `${OPERATION_LABELS[step.operation]} on ${column}`;
}

export async function processColumnTransform(
  file: { name: string; data: string },
  config: ColumnTransformConfig,
): Promise<ColumnTransformResult> {
  const source = readFirstSheet(readWorkbook(file.data), { asString: true }).table;
  if (source.columns.length === 0) {
    throw new Error("The uploaded workbook does not contain a usable header row.");
  }

  const table = cloneTable(source);
  const operationsApplied = [
    applyStep(table, config.option1),
    config.enableSecondOption ? applyStep(table, config.option2) : null,
  ].filter((label): label is string => Boolean(label));

  const { base64 } = buildWorkbookBase64([{ name: "Transformed", table }]);
  return {
    outputFilename: "Column_Transform_Output.xlsx",
    sourceFilename: file.name,
    rowCount: table.rows.length,
    columnCount: table.columns.length,
    operationsApplied,
    preview: previewTable(table),
    workbookBase64: base64,
  };
}
