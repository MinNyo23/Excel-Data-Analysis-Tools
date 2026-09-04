function envFlag(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

const useExternalProcessingApi = envFlag(import.meta.env.VITE_USE_EXTERNAL_PROCESSING_API as string | undefined);
const configuredProcessingApiUrl = (import.meta.env.VITE_PROCESSING_API_URL as string | undefined)?.trim();

// Vercel production uses same-origin /api/trpc unless external processing is explicitly enabled.
// Local dev can set VITE_PROCESSING_API_URL=http://localhost:3000 in .env.
export const PROCESSING_API_BASE_URL =
  useExternalProcessingApi && configuredProcessingApiUrl
    ? configuredProcessingApiUrl.replace(/\/$/, "")
    : import.meta.env.DEV && configuredProcessingApiUrl
      ? configuredProcessingApiUrl.replace(/\/$/, "")
      : "";
