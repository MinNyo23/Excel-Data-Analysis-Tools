import { createHash, randomUUID } from "node:crypto";

type RevokedSession = { expiresAt: number };
const revokedSessions = new Map<string, RevokedSession>();
const MAX_REVOKED_SESSIONS = 20_000;

function tokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function pruneRevokedSessions(now: number) {
  revokedSessions.forEach((entry, key) => {
    if (entry.expiresAt <= now) revokedSessions.delete(key);
  });
  while (revokedSessions.size >= MAX_REVOKED_SESSIONS) {
    const oldestKey = revokedSessions.keys().next().value as string | undefined;
    if (!oldestKey) return;
    revokedSessions.delete(oldestKey);
  }
}

export function newSessionId() {
  return randomUUID();
}

export function revokeSessionToken(token: string, expiresAtMs: number, jti?: string | null) {
  const now = Date.now();
  pruneRevokedSessions(now);
  const expiresAt = Math.max(now, expiresAtMs);
  revokedSessions.set(tokenFingerprint(token), { expiresAt });
  if (jti) revokedSessions.set(`jti:${jti}`, { expiresAt });
}

export function isSessionRevoked(token: string, jti?: string | null) {
  pruneRevokedSessions(Date.now());
  if (revokedSessions.has(tokenFingerprint(token))) return true;
  return Boolean(jti) && revokedSessions.has(`jti:${jti}`);
}
