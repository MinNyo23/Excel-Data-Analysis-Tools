import { describe, expect, it } from "vitest";
import {
  ALLOW_ALL_EMAIL_DOMAINS,
  DEFAULT_ALLOWED_EMAIL_DOMAIN,
  isAllowAllEmailDomains,
  isEmailAllowedForDomain,
  isValidAllowedEmailDomain,
  normalizeAllowedEmailDomain,
} from "../shared/authPolicy";

describe("configurable email-domain policy", () => {
  it("defaults to gmail.com when no setting is available", () => {
    expect(normalizeAllowedEmailDomain(undefined)).toBe(DEFAULT_ALLOWED_EMAIL_DOMAIN);
    expect(normalizeAllowedEmailDomain(null)).toBe(DEFAULT_ALLOWED_EMAIL_DOMAIN);
  });

  it("treats * and empty string as allow-all", () => {
    expect(normalizeAllowedEmailDomain("*")).toBe(ALLOW_ALL_EMAIL_DOMAINS);
    expect(normalizeAllowedEmailDomain("")).toBe(ALLOW_ALL_EMAIL_DOMAINS);
    expect(normalizeAllowedEmailDomain("  *  ")).toBe(ALLOW_ALL_EMAIL_DOMAINS);
    expect(isAllowAllEmailDomains("*")).toBe(true);
    expect(isAllowAllEmailDomains("")).toBe(true);
    expect(isAllowAllEmailDomains(undefined)).toBe(false);
    expect(isValidAllowedEmailDomain("*")).toBe(true);
  });

  it("accepts any email when the policy is allow-all", () => {
    expect(isEmailAllowedForDomain("user@company.com", "*")).toBe(true);
    expect(isEmailAllowedForDomain("User@Other.ORG", "")).toBe(true);
    expect(isEmailAllowedForDomain("a@b.co", ALLOW_ALL_EMAIL_DOMAINS)).toBe(true);
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
