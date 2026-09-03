import * as XLSX from "xlsx";
import type { ExcelInputFile } from "./excelProcessor.js";

function baseName(name: string): string {
  const withoutDir = name.split(/[\\/]/).pop() ?? name;
  const dot = withoutDir.lastIndexOf(".");
  return dot > 0 ? withoutDir.slice(0, dot) : withoutDir;
}

function sheetNameForFile(name: string): string {
  const normalized = baseName(name).toLowerCase();
  if (normalized.includes("addition") || normalized.includes("add")) return "Addition";
  if (normalized.includes("deletion") || normalized.includes("del")) return "Deletion";
  return "Sheet1";
}

function normalizeFile(file: ExcelInputFile): ExcelInputFile {
  if (!file.name.toLowerCase().endsWith(".csv")) return file;
  // Buffer.toString("utf8") transparently handles the UTF-8 BOM that Excel adds.
  const csv = Buffer.from(file.data, "base64").toString("utf8").replace(/^\uFEFF/, "");
  const parsed = XLSX.read(csv, { type: "string", raw: true });
  const firstSheet = parsed.SheetNames[0];
  const worksheet = firstSheet ? parsed.Sheets[firstSheet] : XLSX.utils.aoa_to_sheet([[]]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetNameForFile(file.name));
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return { name: `${baseName(file.name)}.xlsx`, data: Buffer.from(buffer).toString("base64") };
}

export async function normalizeUploadedFiles(files: ExcelInputFile[]): Promise<ExcelInputFile[]> {
  if (!files.some(file => file.name.toLowerCase().endsWith(".csv"))) return files;
  return files.map(normalizeFile);
}
