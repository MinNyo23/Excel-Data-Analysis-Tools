export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_LABEL = "10 MB";

export function isSupportedWorkbookFileName(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase();
  return normalizedName.endsWith(".xlsx") || normalizedName.endsWith(".csv");
}

export function getWorkbookSelectionError(file: Pick<File, "name" | "size">): string | null {
  if (!isSupportedWorkbookFileName(file.name)) return "Only CSV and XLSX files are allowed. Choose a file ending in .csv or .xlsx.";
  if (file.size > MAX_UPLOAD_FILE_BYTES) return `${file.name} is too large. Choose a file no larger than ${MAX_UPLOAD_FILE_SIZE_LABEL}.`;
  return null;
}
