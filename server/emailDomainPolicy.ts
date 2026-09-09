import { getLocalAllowedEmailDomain, saveLocalAllowedEmailDomain } from "./db.js";
import { supabaseGetAllowedEmailDomain, supabaseSaveAllowedEmailDomain, usesSupabaseServerAuth } from "./supabaseIntegration.js";

/** Resolve the active allowed email domain for the current auth mode. */
export async function resolveAllowedEmailDomain() {
  if (usesSupabaseServerAuth) return supabaseGetAllowedEmailDomain();
  return getLocalAllowedEmailDomain();
}

export async function persistAllowedEmailDomain(
  actor: { id: number | string; authProvider?: "manus" | "supabase" | "local" | null },
  domain: string,
) {
  // Follow the signed-in account, not leftover Supabase env vars, so local OTP
  // Master Account saves land in Postgres even if old keys are still present.
  if (actor.authProvider === "supabase" && usesSupabaseServerAuth) {
    return supabaseSaveAllowedEmailDomain(String(actor.id), domain);
  }
  const numericId = typeof actor.id === "number" ? actor.id : Number(actor.id);
  if (!Number.isFinite(numericId)) {
    throw new Error("Email-domain settings require a database-backed Master Account session.");
  }
  return saveLocalAllowedEmailDomain(numericId, domain);
}
