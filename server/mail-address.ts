/** Extract bare email from `Name <user@domain>` or plain address. */
export function parseMailboxAddress(value: string): string {
  const trimmed = value.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  return trimmed.toLowerCase();
}

export function normalizeRecipient(value: string): string {
  return value.trim().toLowerCase();
}
