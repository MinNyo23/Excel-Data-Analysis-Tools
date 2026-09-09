export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_LABEL = "10 MB";
export const MAX_UPLOAD_BATCH_BYTES = 20 * 1024 * 1024;
/** Base64 JSON requests for two max-size workbooks need headroom above raw batch bytes. */
export const MAX_UPLOAD_REQUEST_BYTES = 36 * 1024 * 1024;

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

export function getWorkbookSelectionError(file: Pick<File, "name" | "size">): string | null {
  if (!isSupportedWorkbookFileName(file.name)) return "Only CSV and XLSX files are allowed. Choose a file ending in .csv or .xlsx.";
  if (file.size > MAX_UPLOAD_FILE_BYTES) return `${file.name} is too large. Choose a file no larger than ${MAX_UPLOAD_FILE_SIZE_LABEL}.`;
  return null;
}
