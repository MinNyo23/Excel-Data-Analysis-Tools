import * as XLSX from "xlsx";

/**
 * Shared SheetJS helpers that replace the previous Python (pandas + openpyxl)
 * processing bridge. Everything here runs in-process so the Excel tools work on
 * Vercel serverless functions where spawning `python3` is not possible.
 */

export type CellValue = string | number | boolean | Date | null;
export type Row = Record<string, CellValue>;
export type Table = { columns: string[]; rows: Row[] };
export type Preview = { columns: string[]; rows: CellValue[][] };

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

/** Excel treats a leading apostrophe as a literal-value marker (not displayed). */
export function sanitizeCellValue(value: CellValue): CellValue {
  if (typeof value === "string" && FORMULA_PREFIXES.includes(value.trimStart().charAt(0))) {
    return "'" + value;
  }
  return value;
}

function normalizeCell(value: unknown): CellValue {
  if (value === undefined || value === null || value === "") return value === "" ? "" : null;
  if (value instanceof Date) {
    // Match the previous mm/dd/yyyy day-first friendly output for date cells.
    if (Number.isNaN(value.getTime())) return null;
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
  return String(value);
}

export function readWorkbook(base64: string, options: XLSX.ParsingOptions = {}): XLSX.WorkBook {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new Error("The uploaded workbook is empty.");
  return XLSX.read(buffer, { type: "buffer", cellDates: true, ...options });
}

export function sheetNames(workbook: XLSX.WorkBook): string[] {
  return [...workbook.SheetNames];
}

/**
 * Reads a worksheet into a pandas-like table (header row + object rows).
 * `asString` mirrors `pandas.read_excel(dtype=str)`.
 */
export function readSheet(workbook: XLSX.WorkBook, sheetName: string, options: { asString?: boolean } = {}): Table {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return { columns: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, blankrows: false, defval: null });
  if (matrix.length === 0) return { columns: [], rows: [] };

  const headerRow = matrix[0] ?? [];
  const columns: string[] = [];
  const seen = new Map<string, number>();
  headerRow.forEach((raw, index) => {
    let name = raw === undefined || raw === null ? `Unnamed: ${index}` : String(raw);
    if (seen.has(name)) {
      const next = (seen.get(name) ?? 0) + 1;
      seen.set(name, next);
      name = `${name}.${next}`;
    } else {
      seen.set(name, 0);
    }
    columns.push(name);
  });

  const rows: Row[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const source = matrix[r] ?? [];
    const row: Row = {};
    let hasValue = false;
    columns.forEach((column, index) => {
      let value = normalizeCell(source[index]);
      if (options.asString && value !== null && !(value instanceof Date)) {
        value = String(value as string | number | boolean);
      }
      if (value !== null && value !== "") hasValue = true;
      row[column] = value as CellValue;
    });
    if (hasValue) rows.push(row);
  }

  return { columns, rows };
}

export function readFirstSheet(workbook: XLSX.WorkBook, options: { asString?: boolean } = {}): { sheetName: string; table: Table } {
  const [first] = workbook.SheetNames;
  if (!first) throw new Error("The workbook does not contain any sheets.");
  return { sheetName: first, table: readSheet(workbook, first, options) };
}

function safeSheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[[\]:*?/\\]/g, "").trim().slice(0, 31)) || "Sheet";
  let candidate = base;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 28)} ${counter}`.slice(0, 31);
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

export type SheetSpec = { name: string; table: Table; columnFormats?: Record<string, string> };

/**
 * Builds an XLSX workbook from tables. Every string cell is passed through the
 * formula-injection guard so a downloaded workbook cannot evaluate text that
 * originated from an uploaded file. Optional `columnFormats` apply an Excel
 * number format to every data cell in the named column.
 */
export function buildWorkbookBase64(sheets: SheetSpec[]): { base64: string; sheetNames: string[] } {
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  const finalNames: string[] = [];
  for (const sheet of sheets) {
    const matrix: CellValue[][] = [sheet.table.columns];
    for (const row of sheet.table.rows) {
      matrix.push(sheet.table.columns.map(column => sanitizeCellValue(row[column] ?? null)));
    }
    const worksheet = XLSX.utils.aoa_to_sheet(matrix, { cellDates: true });

    if (sheet.columnFormats && worksheet["!ref"]) {
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      sheet.table.columns.forEach((column, columnIndex) => {
        const format = sheet.columnFormats![column];
        if (!format) return;
        for (let r = 1; r <= range.e.r; r++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r, c: columnIndex })];
          if (cell) {
            cell.z = format;
            if ("w" in cell) delete cell.w;
          }
        }
      });
    }

    const name = safeSheetName(sheet.name, used);
    finalNames.push(name);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return { base64: Buffer.from(buffer).toString("base64"), sheetNames: finalNames };
}

/** Concatenates tables, taking the union of their columns (pandas.concat). */
export function concatTables(tables: Table[]): Table {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const table of tables) {
    for (const column of table.columns) {
      if (!seen.has(column)) {
        seen.add(column);
        columns.push(column);
      }
    }
  }
  const rows: Row[] = [];
  for (const table of tables) {
    for (const row of table.rows) {
      const merged: Row = {};
      for (const column of columns) merged[column] = row[column] ?? null;
      rows.push(merged);
    }
  }
  return { columns, rows };
}

function previewCell(value: CellValue): CellValue {
  if (value instanceof Date) {
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${month}/${day}/${value.getUTCFullYear()}`;
  }
  return value === undefined ? null : value;
}

export function previewTable(table: Table, limit = 50): Preview {
  if (table.rows.length === 0 && table.columns.length === 0) return { columns: [], rows: [] };
  return {
    columns: table.columns,
    rows: table.rows.slice(0, limit).map(row => table.columns.map(column => previewCell(row[column] ?? null))),
  };
}

/** Reads the first sheet header only (used by the column inspector). */
export function readHeaderColumns(base64: string): { sheetName: string; columns: string[] } {
  const workbook = readWorkbook(base64, { sheetRows: 1 });
  const [sheetName] = workbook.SheetNames;
  if (!sheetName) throw new Error("The workbook does not contain a readable sheet.");
  const table = readSheet(workbook, sheetName);
  const columns = table.columns.map(column => String(column).trim()).filter(Boolean);
  return { sheetName, columns: columns.slice(0, 100) };
}
