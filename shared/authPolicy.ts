export const DEFAULT_ALLOWED_EMAIL_DOMAIN = "gmail.com";
/** Sentinel: accept any syntactically valid email (local SMTP OTP / open policy). */
export const ALLOW_ALL_EMAIL_DOMAINS = "*";
const EMAIL_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function adminEmailsSource(): string {
  if (typeof process !== "undefined" && process.env?.ADMIN_EMAILS) return process.env.ADMIN_EMAILS;
  try {
    const viteValue = (import.meta as { env?: { VITE_ADMIN_EMAILS?: string } }).env?.VITE_ADMIN_EMAILS;
    if (typeof viteValue === "string") return viteValue;
  } catch {
    // Non-Vite runtimes only use process.env.ADMIN_EMAILS.
  }
  return "";
}

/** Privileged operator emails from ADMIN_EMAILS (comma-separated). */
export function getAdminEmails(): string[] {
  return adminEmailsSource()
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getPrimaryAdminEmail(): string {
  return getAdminEmails()[0] ?? "";
}

export function isPrivilegedAdminEmail(email: string | null | undefined) {
  const normalized = (email ?? "").trim().toLowerCase();
  return Boolean(normalized) && getAdminEmails().includes(normalized);
}

export function isAdminAccount(user: { email?: string | null; role?: string | null } | null | undefined) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return isPrivilegedAdminEmail(user.email);
}

/** True for `*` or an explicit empty string. `null`/`undefined` are not allow-all. */
export function isAllowAllEmailDomains(value: string | null | undefined) {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase().replace(/^@+/, "");
  return normalized === "" || normalized === ALLOW_ALL_EMAIL_DOMAINS;
}

export function isValidAllowedEmailDomain(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase().replace(/^@+/, "");
  if (normalized === ALLOW_ALL_EMAIL_DOMAINS) return true;
  return EMAIL_DOMAIN_PATTERN.test(normalized);
}

export function normalizeAllowedEmailDomain(value: string | null | undefined) {
  if (value == null) return DEFAULT_ALLOWED_EMAIL_DOMAIN;
  const normalized = value.trim().toLowerCase().replace(/^@+/, "");
  if (normalized === "" || normalized === ALLOW_ALL_EMAIL_DOMAINS) return ALLOW_ALL_EMAIL_DOMAINS;
  return isValidAllowedEmailDomain(normalized) ? normalized : DEFAULT_ALLOWED_EMAIL_DOMAIN;
}

export function isEmailAllowedForDomain(email: string | null | undefined, domain: string | null | undefined) {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (isPrivilegedAdminEmail(normalizedEmail)) return true;
  if (isAllowAllEmailDomains(domain)) return true;
  const normalizedDomain = normalizeAllowedEmailDomain(domain);
  if (normalizedDomain === ALLOW_ALL_EMAIL_DOMAINS) return true;
  return normalizedEmail.endsWith(`@${normalizedDomain}`);
}
