export const DEFAULT_ALLOWED_EMAIL_DOMAIN = "gmail.com";
export const MASTER_ADMIN_EMAIL = "minnyo.work@gmail.com";
const EMAIL_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function isValidAllowedEmailDomain(value: string | null | undefined) {
  return EMAIL_DOMAIN_PATTERN.test((value ?? "").trim().toLowerCase().replace(/^@+/, ""));
}

export function normalizeAllowedEmailDomain(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase().replace(/^@+/, "");
  return isValidAllowedEmailDomain(normalized) ? normalized : DEFAULT_ALLOWED_EMAIL_DOMAIN;
}

export function isEmailAllowedForDomain(email: string | null | undefined, domain: string | null | undefined) {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (normalizedEmail === MASTER_ADMIN_EMAIL) return true;
  const normalizedDomain = normalizeAllowedEmailDomain(domain);
  return normalizedEmail.endsWith(`@${normalizedDomain}`);
}
