export const DEFAULT_ALLOWED_EMAIL_DOMAIN = "gmail.com";
/** Sentinel: accept any syntactically valid email (local SMTP OTP / open policy). */
export const ALLOW_ALL_EMAIL_DOMAINS = "*";
export const MASTER_ADMIN_EMAIL = "minnyo.work@gmail.com";
const EMAIL_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

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
  if (normalizedEmail === MASTER_ADMIN_EMAIL) return true;
  if (isAllowAllEmailDomains(domain)) return true;
  const normalizedDomain = normalizeAllowedEmailDomain(domain);
  if (normalizedDomain === ALLOW_ALL_EMAIL_DOMAINS) return true;
  return normalizedEmail.endsWith(`@${normalizedDomain}`);
}
