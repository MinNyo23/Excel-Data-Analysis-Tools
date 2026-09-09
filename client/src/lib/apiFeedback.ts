type ApiErrorLike = {
  message?: unknown;
  data?: { code?: unknown; httpStatus?: unknown; retryAfterSeconds?: unknown };
  meta?: { response?: { headers?: { get?: (name: string) => string | null } } };
};

const RATE_LIMIT_EVENT = "excel-tool-rate-limit";

function apiErrorDetails(error: unknown) {
  const candidate = (error && typeof error === "object" ? error : {}) as ApiErrorLike;
  return {
    message: typeof candidate.message === "string" ? candidate.message : "",
    code: typeof candidate.data?.code === "string" ? candidate.data.code : "",
    httpStatus: typeof candidate.data?.httpStatus === "number" ? candidate.data.httpStatus : undefined,
    retryAfterSeconds: typeof candidate.data?.retryAfterSeconds === "number" ? candidate.data.retryAfterSeconds : undefined,
    retryAfterHeader: candidate.meta?.response?.headers?.get?.("retry-after") ?? null,
  };
}

export function getRateLimitRetrySeconds(error: unknown) {
  const details = apiErrorDetails(error);
  const looksRateLimited = details.code === "TOO_MANY_REQUESTS" || details.httpStatus === 429 || /too many requests|rate limit/i.test(details.message);
  if (!looksRateLimited) return null;
  const headerValue = details.retryAfterHeader ? Number(details.retryAfterHeader) : undefined;
  const requested = details.retryAfterSeconds ?? headerValue ?? 60;
  return Number.isFinite(requested) ? Math.max(1, Math.min(600, Math.ceil(requested))) : 60;
}

export function isUnauthenticatedApiError(error: unknown) {
  const details = apiErrorDetails(error);
  return details.code === "UNAUTHORIZED" || details.httpStatus === 401;
}

export function isPassiveCurrentUserQuery(queryKey: unknown) {
  if (!Array.isArray(queryKey)) return false;
  const isCurrentUserPath = (candidate: unknown) => Array.isArray(candidate) && candidate[0] === "auth" && candidate[1] === "me";
  const isPassiveDashboardPath = (candidate: unknown) => {
    if (!Array.isArray(candidate)) return false;
    if (candidate[0] === "profile" && candidate[1] === "me") return true;
    if (candidate[0] === "processHistory" && (candidate[1] === "list" || (candidate[1] === "retention" && candidate[2] === "get"))) return true;
    return false;
  };
  return isCurrentUserPath(queryKey) || queryKey.some(candidate => isCurrentUserPath(candidate) || isPassiveDashboardPath(candidate));
}

export function getFriendlyApiMessage(error: unknown, fallback: string) {
  const details = apiErrorDetails(error);
  if (getRateLimitRetrySeconds(error)) return "You have reached a temporary request limit. Please wait for the countdown before trying again.";
  if (isUnauthenticatedApiError(error)) return "Your session has ended. Please sign in again and retry your action.";
  if (details.code === "FORBIDDEN" || details.httpStatus === 403) return "This action is not available for your account or request.";
  if (details.code === "BAD_REQUEST") {
    if (details.message && /upload limit|too large|Only CSV and XLSX|valid ZIP|workbook|File name is invalid|Combined upload|not valid base64|exceeds the/i.test(details.message)) {
      return details.message;
    }
    return "We could not use that request. Please check your selected file or settings and try again.";
  }
  if (details.httpStatus === 413 || /too large|exceeds the.*limit/i.test(details.message)) return "The upload is too large. Choose a smaller CSV or XLSX file and try again.";
  return fallback;
}

export function reportRateLimitIfPresent(error: unknown) {
  const retryAfterSeconds = getRateLimitRetrySeconds(error);
  if (!retryAfterSeconds || typeof window === "undefined") return null;
  window.dispatchEvent(new CustomEvent(RATE_LIMIT_EVENT, { detail: { retryAfterSeconds } }));
  return retryAfterSeconds;
}

export function rateLimitEventName() {
  return RATE_LIMIT_EVENT;
}
