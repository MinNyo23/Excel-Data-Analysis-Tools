import { TRPCError } from "@trpc/server";
import { listAllProcessHistory, listAllUsers } from "./db.js";

export const MASTER_ADMIN_EMAIL = "minnyo.work@gmail.com";

export function isMasterAdmin(user: { email?: string | null } | null | undefined) {
  return user?.email?.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}

export function requireMasterAdmin(user: { email?: string | null } | null | undefined) {
  if (!isMasterAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Master account access required." });
  return true;
}

export async function listManagedUsers(actor: { email?: string | null } | null | undefined) {
  requireMasterAdmin(actor);
  const [userRows, history] = await Promise.all([listAllUsers(), listAllProcessHistory()]);
  const usage = new Map<string, { workflows: number; files: number; records: number; lastActivity: string | null }>();
  for (const row of history ?? []) {
    const current = usage.get(String(row.userId)) ?? { workflows: 0, files: 0, records: 0, lastActivity: null };
    current.workflows += 1;
    current.records += Number(row.totalRecords ?? 0);
    try { current.files += Array.isArray(JSON.parse(row.inputFileNames)) ? JSON.parse(row.inputFileNames).length : 0; } catch {}
    if (!current.lastActivity || new Date(row.completedAt).getTime() > new Date(current.lastActivity).getTime()) current.lastActivity = new Date(row.completedAt).toISOString();
    usage.set(String(row.userId), current);
  }
  return userRows.map((user: any) => ({ id: String(user.id), email: user.email ?? "", createdAt: user.createdAt, lastSignInAt: user.lastSignedIn, bannedUntil: null, emailConfirmed: true, ...(usage.get(String(user.id)) ?? { workflows: 0, files: 0, records: 0, lastActivity: null }) }));
}

export async function moderateUser(actor: { email?: string | null } | null | undefined, userId: string, action: "ban" | "unban" | "delete") {
  requireMasterAdmin(actor);
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Admin action '${action}' requires the authentication provider's admin API and is not available for this database-backed account.` });
}
