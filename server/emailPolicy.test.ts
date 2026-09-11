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

  it("keeps configured admin emails eligible after the domain changes", () => {
    const previous = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "ops.admin@example.com";
    expect(isEmailAllowedForDomain("ops.admin@example.com", "company.com")).toBe(true);
    expect(isEmailAllowedForDomain("other@gmail.com", "company.com")).toBe(false);
    process.env.ADMIN_EMAILS = previous;
  });

  it("creates the local email-policy table when it is missing", () => {
    const db = require("node:fs").readFileSync("server/db.ts", "utf8");
    expect(db).toContain("CREATE TABLE IF NOT EXISTS \"admin_auth_settings\"");
    expect(db).toContain("ensureAdminAuthSettingsTable");
  });

  it("validates domains before they are saved", () => {
    expect(isValidAllowedEmailDomain("@company.com")).toBe(true);
    expect(isValidAllowedEmailDomain("company")).toBe(false);
    expect(isValidAllowedEmailDomain("company.com.evil/")).toBe(false);
  });
});
