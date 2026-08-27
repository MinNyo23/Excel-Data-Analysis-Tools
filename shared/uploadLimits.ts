export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_LABEL = "10 MB";

export function isSupportedWorkbookFileName(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase();
  return normalizedName.endsWith(".xlsx") || normalizedName.endsWith(".csv");
}
