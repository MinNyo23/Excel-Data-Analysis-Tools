const configuredProcessingApiUrl = (import.meta.env.VITE_PROCESSING_API_URL as string | undefined)?.trim();

// Workbook payloads must bypass Vercel Functions because Vercel rejects large
// request bodies before the application can handle them. In local development,
// route processing to the same machine unless explicitly configured otherwise.
const DEFAULT_PROCESSING_API_URL = import.meta.env.DEV
  ? "http://localhost:3000"
  : "https://3000-il1ewvzwfbgv4rg9wy6pi-abbe9b7d.us4.manus.computer";
export const PROCESSING_API_BASE_URL = (configuredProcessingApiUrl || DEFAULT_PROCESSING_API_URL).replace(/\/$/, "");
