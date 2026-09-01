import { describe, expect, it } from "vitest";
import { DEFAULT_ALLOWED_EMAIL_DOMAIN, isEmailAllowedForDomain, isValidAllowedEmailDomain, normalizeAllowedEmailDomain } from "../shared/authPolicy";

describe("configurable email-domain policy", () => {
  it("defaults to gmail.com when no setting is available", () => {
    expect(normalizeAllowedEmailDomain(undefined)).toBe(DEFAULT_ALLOWED_EMAIL_DOMAIN);
  });

  it("accepts exact case-insensitive domain matches", () => {
    expect(isEmailAllowedForDomain("User@GMAIL.COM", "gmail.com")).toBe(true);
    expect(isEmailAllowedForDomain("user@company.com", "gmail.com")).toBe(false);
  });

  it("does not accept lookalike suffixes", () => {
    expect(isEmailAllowedForDomain("user@gmail.com.evil.example", "gmail.com")).toBe(false);
  });

  it("keeps the Master Account eligible after the domain changes", () => {
    expect(isEmailAllowedForDomain("minnyo.work@gmail.com", "company.com")).toBe(true);
  });

  it("validates domains before they are saved", () => {
    expect(isValidAllowedEmailDomain("@company.com")).toBe(true);
    expect(isValidAllowedEmailDomain("company")).toBe(false);
    expect(isValidAllowedEmailDomain("company.com.evil/")).toBe(false);
  });
});
