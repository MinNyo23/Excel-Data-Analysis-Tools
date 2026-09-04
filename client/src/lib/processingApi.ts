const configuredProcessingApiUrl = (import.meta.env.VITE_PROCESSING_API_URL as string | undefined)?.trim();

// Workbook payloads must bypass Vercel Functions because Vercel rejects large
// request bodies before the application can handle them. Keep this fallback
// limited to workbook routes; auth and account routes remain same-origin.
const DEFAULT_PROCESSING_API_URL = "https://3000-il1ewvzwfbgv4rg9wy6pi-abbe9b7d.us4.manus.computer";
export const PROCESSING_API_BASE_URL = (configuredProcessingApiUrl || DEFAULT_PROCESSING_API_URL).replace(/\/$/, "");
