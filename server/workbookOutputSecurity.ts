import * as XLSX from "xlsx";
import { sanitizeCellValue } from "./xlsx/workbook.js";

const MAX_GENERATED_WORKBOOK_BYTES = 40 * 1024 * 1024;
const MAX_GENERATED_WORKBOOK_BASE64_LENGTH = Math.ceil(MAX_GENERATED_WORKBOOK_BYTES / 3) * 4;

type WorkbookResult = { workbookBase64: string; [key: string]: unknown };

function isStrictBase64(value: string) {
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/**
 * Every generated XLSX passes through this in-memory guard before the API sends
 * it to the browser. Workbooks produced by the tools are already sanitized when
 * they are built, but this second pass re-reads the bytes and forces any
 * formula-like text to a literal cell value so a later Excel download cannot
 * evaluate content that originated from an uploaded workbook.
 */
export async function sanitizeGeneratedWorkbookOutput<T extends WorkbookResult>(result: T): Promise<T> {
  if (!isStrictBase64(result.workbookBase64) || result.workbookBase64.length > MAX_GENERATED_WORKBOOK_BASE64_LENGTH) {
    throw new Error("Generated workbook could not be prepared for download.");
  }

  try {
    const buffer = Buffer.from(result.workbookBase64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_GENERATED_WORKBOOK_BYTES) {
      throw new Error("Generated workbook exceeds the safe download limit.");
    }

    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    let mutated = false;
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet || !worksheet["!ref"]) continue;
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const address = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[address];
          if (cell && cell.t === "s" && typeof cell.v === "string") {
            const sanitized = sanitizeCellValue(cell.v);
            if (sanitized !== cell.v) {
              cell.v = sanitized;
              if ("w" in cell) delete cell.w;
              mutated = true;
            }
          }
        }
      }
    }

    if (!mutated) return result;

    const outputBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    if (outputBuffer.length === 0 || outputBuffer.length > MAX_GENERATED_WORKBOOK_BYTES) {
      throw new Error("Generated workbook exceeds the safe download limit.");
    }
    const workbookBase64 = Buffer.from(outputBuffer).toString("base64");
    if (!isStrictBase64(workbookBase64) || workbookBase64.length > MAX_GENERATED_WORKBOOK_BASE64_LENGTH) {
      throw new Error("Generated workbook could not be prepared for download.");
    }
    return { ...result, workbookBase64 };
  } catch (error) {
    throw error instanceof Error && error.message.includes("safe download limit")
      ? error
      : new Error("Generated workbook could not be prepared for download.");
  }
}
