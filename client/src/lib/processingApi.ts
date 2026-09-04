import {
  getWorkbookSelectionError,
  MAX_UPLOAD_FILE_SIZE_LABEL,
  MAX_VERCEL_SAME_ORIGIN_FILE_BYTES,
  MAX_VERCEL_SAME_ORIGIN_FILE_SIZE_LABEL,
} from "@shared/uploadLimits";

const configuredProcessingApiUrl = (import.meta.env.VITE_PROCESSING_API_URL as string | undefined)?.trim();

// Workbook uploads are base64-encoded in JSON and exceed Vercel's ~4.5 MB function
// payload cap unless routed to an external Node processing service.
export const PROCESSING_API_BASE_URL = configuredProcessingApiUrl?.replace(/\/$/, "") ?? "";
export const USES_EXTERNAL_PROCESSING_API = Boolean(PROCESSING_API_BASE_URL);

export const CLIENT_MAX_UPLOAD_FILE_SIZE_LABEL =
  USES_EXTERNAL_PROCESSING_API || import.meta.env.DEV
    ? MAX_UPLOAD_FILE_SIZE_LABEL
    : MAX_VERCEL_SAME_ORIGIN_FILE_SIZE_LABEL;

export function getClientWorkbookSelectionError(file: Pick<File, "name" | "size">) {
  if (USES_EXTERNAL_PROCESSING_API || import.meta.env.DEV) return getWorkbookSelectionError(file);
  return getWorkbookSelectionError(file, {
    maxBytes: MAX_VERCEL_SAME_ORIGIN_FILE_BYTES,
    maxLabel: MAX_VERCEL_SAME_ORIGIN_FILE_SIZE_LABEL,
  });
}
