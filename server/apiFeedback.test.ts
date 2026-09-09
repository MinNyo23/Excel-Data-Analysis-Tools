import { describe, expect, it } from "vitest";
import { getFriendlyApiMessage, getRateLimitRetrySeconds, isPassiveCurrentUserQuery, isUnauthenticatedApiError } from "../client/src/lib/apiFeedback";

describe("API feedback helpers", () => {
  it("detects a typed rate-limit retry window and returns a helpful wait message", () => {
    const error = { message: "Too many requests", data: { code: "TOO_MANY_REQUESTS", httpStatus: 429, retryAfterSeconds: 42 } };
    expect(getRateLimitRetrySeconds(error)).toBe(42);
    expect(getFriendlyApiMessage(error, "Fallback")).toMatch(/wait for the countdown/i);
  });

  it("uses response retry headers when an API guard returns HTTP 429 before tRPC", () => {
    const error = { message: "Too many requests", meta: { response: { headers: { get: (name: string) => name === "retry-after" ? "17" : null } } } };
    expect(getRateLimitRetrySeconds(error)).toBe(17);
  });

  it("returns clear, non-technical messages for common client-safe failure types", () => {
    expect(getFriendlyApiMessage({ data: { code: "UNAUTHORIZED", httpStatus: 401 } }, "Fallback")).toMatch(/sign in again/i);
    expect(getFriendlyApiMessage({ message: "File exceeds the 10 MB upload limit.", data: { code: "BAD_REQUEST", httpStatus: 400 } }, "Fallback")).toBe("File exceeds the 10 MB upload limit.");
    expect(getFriendlyApiMessage({ data: { code: "BAD_REQUEST", httpStatus: 400 } }, "Fallback")).toMatch(/selected file or settings/i);
    expect(getFriendlyApiMessage(new Error("internal detail"), "The requested workbook could not be processed. Please try again.")).toBe("The requested workbook could not be processed. Please try again.");
  });

  it("identifies an expected signed-out API response so passive account reads can stay quiet", () => {
    expect(isUnauthenticatedApiError({ data: { code: "UNAUTHORIZED", httpStatus: 401 } })).toBe(true);
    expect(isUnauthenticatedApiError({ data: { code: "FORBIDDEN", httpStatus: 403 } })).toBe(false);
  });

  it("recognizes only the passive current-user query for quiet signed-out feedback", () => {
    expect(isPassiveCurrentUserQuery([["auth", "me"], { type: "query" }])).toBe(true);
    expect(isPassiveCurrentUserQuery([["profile", "me"], { type: "query" }])).toBe(true);
    expect(isPassiveCurrentUserQuery([["processHistory", "list"], { type: "query" }])).toBe(true);
    expect(isPassiveCurrentUserQuery([["processHistory", "retention", "get"], { type: "query" }])).toBe(true);
    expect(isPassiveCurrentUserQuery([["excel", "process"], { type: "mutation" }])).toBe(false);
  });
});
