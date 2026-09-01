const configuredProcessingApiUrl = import.meta.env.VITE_PROCESSING_API_URL as string | undefined;

// The Vercel project is a static frontend. Keep a browser-safe fallback so an
// omitted Vercel environment variable cannot route API calls to /api/trpc on the
// static host and produce FUNCTION_INVOCATION_FAILED responses.
export const PROCESSING_API_BASE_URL = (configuredProcessingApiUrl || "https://3000-il1ewvzwfbgv4rg9wy6pi-abbe9b7d.us4.manus.computer").replace(/\/$/, "");
