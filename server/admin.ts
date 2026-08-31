import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";

export const MASTER_ADMIN_EMAIL = "minnyo.work@gmail.com";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
const adminClient = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

export function isMasterAdmin(user: { email?: string | null } | null | undefined) {
  return user?.email?.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}

export function requireMasterAdmin(user: { email?: string | null } | null | undefined) {
  if (!isMasterAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Master account access required." });
  if (!adminClient) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Admin service is not configured." });
  return adminClient;
}

export async function listManagedUsers(actor: { email?: string | null } | null | undefined) {
  const client = requireMasterAdmin(actor);
  const { data: users, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("Could not load users.");
  const ids = (users.users ?? []).map(user => user.id);
  const { data: history, error: historyError } = ids.length
    ? await client.from("process_history").select("user_id,input_file_names,total_records,completed_at").in("user_id", ids)
    : { data: [], error: null };
  if (historyError) throw new Error("Could not load usage metrics.");
  const usage = new Map<string, { workflows: number; files: number; records: number; lastActivity: string | null }>();
  for (const row of history ?? []) {
    const current = usage.get(row.user_id) ?? { workflows: 0, files: 0, records: 0, lastActivity: null };
    current.workflows += 1;
    current.records += Number(row.total_records ?? 0);
    try { current.files += Array.isArray(JSON.parse(row.input_file_names)) ? JSON.parse(row.input_file_names).length : 0; } catch {}
    if (!current.lastActivity || new Date(row.completed_at).getTime() > new Date(current.lastActivity).getTime()) current.lastActivity = row.completed_at;
    usage.set(row.user_id, current);
  }
  return (users.users ?? []).map(user => ({ id: user.id, email: user.email ?? "", createdAt: user.created_at, lastSignInAt: user.last_sign_in_at, bannedUntil: user.banned_until ?? null, emailConfirmed: Boolean(user.email_confirmed_at), ...(usage.get(user.id) ?? { workflows: 0, files: 0, records: 0, lastActivity: null }) }));
}

export async function moderateUser(actor: { email?: string | null } | null | undefined, userId: string, action: "ban" | "unban" | "delete") {
  const client = requireMasterAdmin(actor);
  if (action === "delete") {
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) throw new Error("Could not delete user.");
    return { success: true };
  }
  const { error } = await client.auth.admin.updateUserById(userId, { ban_duration: action === "ban" ? "876000h" : "none" });
  if (error) throw new Error("Could not update user access.");
  return { success: true };
}
