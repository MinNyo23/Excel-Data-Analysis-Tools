import { getLocalAllowedEmailDomain, saveLocalAllowedEmailDomain } from "./db.js";
import { supabaseGetAllowedEmailDomain, supabaseSaveAllowedEmailDomain, usesSupabaseServerAuth } from "./supabaseIntegration.js";

/** Resolve the active allowed email domain for the current auth mode. */
export async function resolveAllowedEmailDomain() {
  if (usesSupabaseServerAuth) return supabaseGetAllowedEmailDomain();
  return getLocalAllowedEmailDomain();
}

export async function persistAllowedEmailDomain(actorId: number | string, domain: string) {
  if (usesSupabaseServerAuth) {
    return supabaseSaveAllowedEmailDomain(String(actorId), domain);
  }
  const numericId = typeof actorId === "number" ? actorId : Number(actorId);
  if (!Number.isFinite(numericId)) {
    throw new Error("Email-domain settings require a database-backed Master Account session.");
  }
  return saveLocalAllowedEmailDomain(numericId, domain);
}
