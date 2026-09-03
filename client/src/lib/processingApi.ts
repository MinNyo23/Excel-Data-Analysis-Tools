const configuredProcessingApiUrl = (import.meta.env.VITE_PROCESSING_API_URL as string | undefined)?.trim();

/**
 * External processing is opt-in. Never fall back to a stale preview/sandbox
 * hostname: that can produce opaque 500s after the sandbox is terminated.
 */
export const PROCESSING_API_BASE_URL = configuredProcessingApiUrl
  ? configuredProcessingApiUrl.replace(/\/$/, "")
  : null;

export function getProcessingApiBaseUrl(useExternalProcessing: boolean) {
  if (!useExternalProcessing) return "";
  if (!PROCESSING_API_BASE_URL) {
    throw new Error("Excel processing is not configured. Set VITE_PROCESSING_API_URL or disable external processing.");
  }
  return PROCESSING_API_BASE_URL;
}
