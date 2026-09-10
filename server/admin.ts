import { TRPCError } from "@trpc/server";
import { isAdminAccount } from "../shared/authPolicy.js";
import { listAllProcessHistory, listAllUsers } from "./db.js";
import { persistAllowedEmailDomain, resolveAllowedEmailDomain } from "./emailDomainPolicy.js";
import { supabaseListAllProcessHistory, supabaseListAllUsers, supabaseListUserActionHistory, supabaseModerateUser, usesSupabaseServerAuth, type SupabaseAdminAction } from "./supabaseIntegration.js";

export { isAdminAccount };
export { resolveAllowedEmailDomain } from "./emailDomainPolicy.js";

export function isMasterAdmin(user: { email?: string | null; role?: string | null } | null | undefined) {
  return isAdminAccount(user);
}

export function requireMasterAdmin(user: { email?: string | null; role?: string | null } | null | undefined) {
  if (!isMasterAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Master account access required." });
  return true;
}

export async function listManagedUsers(actor: { email?: string | null; authProvider?: "manus" | "supabase" | "local" | null } | null | undefined) {
  requireMasterAdmin(actor);
  const isSupabaseAccount = actor?.authProvider === "supabase";
  const [userRows, history] = isSupabaseAccount
    ? await Promise.all([supabaseListAllUsers(), supabaseListAllProcessHistory()])
    : await Promise.all([listAllUsers(), listAllProcessHistory()]);
  const usage = new Map<string, { workflows: number; files: number; records: number; lastActivity: string | null }>();
  for (const row of history ?? []) {
    const current = usage.get(String(row.userId)) ?? { workflows: 0, files: 0, records: 0, lastActivity: null };
    current.workflows += 1;
    current.records += Number(row.totalRecords ?? 0);
    try { current.files += Array.isArray(JSON.parse(row.inputFileNames)) ? JSON.parse(row.inputFileNames).length : 0; } catch {}
    if (!current.lastActivity || new Date(row.completedAt).getTime() > new Date(current.lastActivity).getTime()) current.lastActivity = new Date(row.completedAt).toISOString();
    usage.set(String(row.userId), current);
  }
  return userRows.map((user: any) => ({ id: String(user.id), email: user.email ?? "", createdAt: user.createdAt, lastSignInAt: user.lastSignedIn, bannedUntil: user.bannedUntil ?? null, emailConfirmed: user.emailConfirmed ?? true, ...(usage.get(String(user.id)) ?? { workflows: 0, files: 0, records: 0, lastActivity: null }) }));
}

export async function moderateUser(actor: { id: number | string; email?: string | null; authProvider?: "manus" | "supabase" | "local" | null } | null | undefined, userId: string, action: SupabaseAdminAction) {
  requireMasterAdmin(actor);
  if (actor?.authProvider === "supabase") return supabaseModerateUser({ id: String(actor.id), email: actor.email }, userId, action);
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Admin action '${action}' requires the authentication provider's admin API and is not available for this database-backed account.` });
}

export async function listUserActionHistory(actor: { id: number | string; email?: string | null; authProvider?: "manus" | "supabase" | "local" | null } | null | undefined) {
  requireMasterAdmin(actor);
  return actor?.authProvider === "supabase" ? supabaseListUserActionHistory(String(actor.id)) : [];
}

export async function getAllowedEmailDomain(actor: { email?: string | null; authProvider?: "manus" | "supabase" | "local" | null } | null | undefined) {
  requireMasterAdmin(actor);
  return resolveAllowedEmailDomain();
}

export async function updateAllowedEmailDomain(actor: { id: number | string; email?: string | null; authProvider?: "manus" | "supabase" | "local" | null } | null | undefined, domain: string) {
  requireMasterAdmin(actor);
  try {
    return await persistAllowedEmailDomain(actor!, domain);
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[Admin] Email-domain policy update failed", error instanceof Error ? error.message : "unknown error");
    const message = error instanceof Error ? error.message : "Email-domain policy could not be saved.";
    if (/valid email domain|Master Account eligible|database-backed Master Account/i.test(message)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message, cause: error });
    }
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: usesSupabaseServerAuth
        ? "The email policy table is not ready. Apply the admin email policy migration, then try again."
        : "The email policy table is not ready. Run database migrations (db:push), then try again.",
      cause: error,
    });
  }
}
