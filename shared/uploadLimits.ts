export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_LABEL = "10 MB";
export const MAX_UPLOAD_BATCH_BYTES = 20 * 1024 * 1024;
/** Base64 JSON requests for two max-size workbooks need headroom above raw batch bytes. */
export const MAX_UPLOAD_REQUEST_BYTES = 36 * 1024 * 1024;
/** Vercel serverless functions reject request bodies above ~4.5 MB before app code runs. */
export const VERCEL_FUNCTION_PAYLOAD_BYTES = Math.floor(4.5 * 1024 * 1024);
/** Base64 expansion is ~4/3; keep raw workbook size under the Vercel function payload cap. */
export const MAX_VERCEL_SAME_ORIGIN_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_VERCEL_SAME_ORIGIN_FILE_SIZE_LABEL = "3 MB";

export function isSupportedWorkbookFileName(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase();
  return normalizedName.endsWith(".xlsx") || normalizedName.endsWith(".csv");
}

export function isSafeUploadValidationMessage(message: string) {
  const normalized = message.trim();
  if (!normalized || normalized.length > 240) return false;
  if (/[\r\n]/.test(normalized)) return false;
  return /upload limit|too large|Only CSV and XLSX|valid ZIP|workbook|archive|File name is invalid|Combined upload size|Upload between|could not be read|not valid base64|binary content|exceeds the/i.test(normalized);
}

export function getWorkbookSelectionError(
  file: Pick<File, "name" | "size">,
  options?: { maxBytes?: number; maxLabel?: string },
): string | null {
  const maxBytes = options?.maxBytes ?? MAX_UPLOAD_FILE_BYTES;
  const maxLabel = options?.maxLabel ?? MAX_UPLOAD_FILE_SIZE_LABEL;
  if (!isSupportedWorkbookFileName(file.name)) return "Only CSV and XLSX files are allowed. Choose a file ending in .csv or .xlsx.";
  if (file.size > maxBytes) return `${file.name} is too large. Choose a file no larger than ${maxLabel}.`;
  return null;
}
