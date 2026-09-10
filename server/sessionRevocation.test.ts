import { describe, expect, it } from "vitest";
import { isSessionRevoked, revokeSessionToken } from "./sessionRevocation";

describe("session token revocation", () => {
  it("rejects a token fingerprint and jti after logout until expiry", () => {
    const token = "session-token-sample";
    const jti = "session-jti-sample";
    expect(isSessionRevoked(token, jti)).toBe(false);
    revokeSessionToken(token, Date.now() + 60_000, jti);
    expect(isSessionRevoked(token, null)).toBe(true);
    expect(isSessionRevoked("other-token", jti)).toBe(true);
  });
});
