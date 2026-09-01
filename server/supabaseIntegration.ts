import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { DEFAULT_ALLOWED_EMAIL_DOMAIN, isEmailAllowedForDomain, isValidAllowedEmailDomain, MASTER_ADMIN_EMAIL, normalizeAllowedEmailDomain } from "../shared/authPolicy.js";
import { decryptProfileValue, encryptProfileValue } from "./profileEncryption.js";
import type { EditableUserProfile, ProcessHistoryDateRange, RetentionDays, SecurityAuditMetadata } from "./db.js";

export type ApplicationUser = {
  id: number | string;
  openId: string;
  name?: string | null;
  email?: string | null;
  role: "user" | "admin";
  authProvider: "manus" | "supabase";
};

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export function isSupabaseUserId(userId: ApplicationUser["id"]): userId is string {
  return typeof userId === "string" && /^[0-9a-f-]{36}$/i.test(userId);
}

export async function authenticateSupabaseRequest(req: Request): Promise<ApplicationUser | null> {
  const authorization = req.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  const allowedDomain = await supabaseGetAllowedEmailDomain();
  if (!isEmailAllowedForDomain(data.user.email, allowedDomain)) return null;
  const metadata = data.user.user_metadata ?? {};
  // User metadata is editable by the user in Supabase Auth. Roles must instead
  // come from the protected application-account record created by the database trigger.
  const { data: account } = await supabaseAdmin.from("app_user_accounts").select("role").eq("user_id", data.user.id).maybeSingle();
  return {
    id: data.user.id,
    openId: data.user.id,
    name: typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null,
    email: data.user.email ?? null,
    role: account?.role === "admin" ? "admin" : "user",
    authProvider: "supabase",
  };
}

function requireAdmin() {
  if (!supabaseAdmin) throw new Error("Supabase server integration is not configured.");
  return supabaseAdmin;
}

export async function supabaseGetAllowedEmailDomain() {
  if (!supabaseAdmin) return DEFAULT_ALLOWED_EMAIL_DOMAIN;
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_auth_settings")
      .select("allowed_email_domain")
      .eq("setting_key", "email_domain")
      .maybeSingle();
    if (error) return DEFAULT_ALLOWED_EMAIL_DOMAIN;
    return normalizeAllowedEmailDomain(data?.allowed_email_domain);
  } catch {
    return DEFAULT_ALLOWED_EMAIL_DOMAIN;
  }
}

export async function supabaseSaveAllowedEmailDomain(actorId: string, domain: string) {
  if (!isValidAllowedEmailDomain(domain)) throw new Error("Enter a valid email domain, such as gmail.com.");
  const normalized = normalizeAllowedEmailDomain(domain);
  if (!isEmailAllowedForDomain(MASTER_ADMIN_EMAIL, normalized)) throw new Error("The allowed domain must keep the Master Account eligible to sign in.");
  const { error } = await requireAdmin()
    .from("admin_auth_settings")
    .upsert({ setting_key: "email_domain", allowed_email_domain: normalized, updated_by: actorId, updated_at: new Date().toISOString() });
  if (error) throw new Error("Email-domain policy could not be saved.");
  return normalized;
}

export async function supabaseListAllUsers() {
  const { data, error } = await requireAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("Supabase user list failed.");
  return (data.users ?? []).map(user => ({
    id: user.id,
    email: user.email ?? "",
    createdAt: user.created_at ?? null,
    lastSignedIn: user.last_sign_in_at ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    bannedUntil: user.banned_until ?? null,
  }));
}

export async function supabaseListAllProcessHistory() {
  const { data, error } = await requireAdmin()
    .from("process_history")
    .select("id,user_id,tool_key,tool_name,status,input_file_names,output_filename,total_records,completed_at")
    .order("completed_at", { ascending: false })
    .limit(10000);
  if (error) throw new Error("Supabase process-history list failed.");
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    toolKey: row.tool_key,
    toolName: row.tool_name,
    status: row.status,
    inputFileNames: row.input_file_names,
    outputFilename: row.output_filename,
    totalRecords: row.total_records,
    completedAt: new Date(row.completed_at),
  }));
}

export type SupabaseAdminAction = "ban" | "unban" | "delete";
type AdminActionHistoryStatus = "completed" | "failed";
type AdminActionHistoryRecord = {
  actorId: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string;
  action: SupabaseAdminAction;
};
type AdminActionHistoryStorage =
  | { kind: "structured"; id: string | number }
  | { kind: "security-audit"; id: string | number };

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (error.code === "PGRST205" || /could not find the table/i.test(error.message ?? "")));
}

function adminActionMetadata(record: AdminActionHistoryRecord, status: AdminActionHistoryStatus) {
  return safeAuditMetadata({
    action: record.action,
    targetId: record.targetUserId,
    target: record.targetEmail,
    status,
  });
}

async function insertAdminActionHistory(admin: ReturnType<typeof requireAdmin>, record: AdminActionHistoryRecord, status: AdminActionHistoryStatus): Promise<AdminActionHistoryStorage> {
  const { data: historyRow, error: historyError } = await admin
    .from("admin_user_action_history")
    .insert({ actor_id: record.actorId, actor_email: record.actorEmail, target_user_id: record.targetUserId, target_email: record.targetEmail, action: record.action, status })
    .select("id")
    .single();
  if (!historyError && historyRow) return { kind: "structured", id: historyRow.id };

  // The structured table is deployed by an optional migration. Fall back not
  // only when it is absent, but also when an older schema rejects a target-user
  // reference; the Auth action must not be reported as failed after completion.
  if (!isMissingRelationError(historyError)) {
    console.warn("[Supabase] Structured admin history write failed; using security audit history.");
  }

  const { data: auditRow, error: auditError } = await admin
    .from("security_audit_events")
    .insert({ user_id: record.actorId, event_type: "admin_action", metadata: adminActionMetadata(record, status) })
    .select("id")
    .single();
  if (auditError || !auditRow) throw new Error("Admin action history could not be recorded.");
  return { kind: "security-audit", id: auditRow.id };
}

export async function supabaseModerateUser(actor: { id: string; email?: string | null }, targetUserId: string, action: SupabaseAdminAction) {
  if (actor.id === targetUserId) throw new Error("The Master Account cannot be modified.");
  const admin = requireAdmin();
  const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
  if (targetError || !targetData.user) throw new Error("Supabase user not found.");

  const record: AdminActionHistoryRecord = {
    actorId: actor.id,
    actorEmail: actor.email ?? "",
    targetUserId,
    targetEmail: targetData.user.email ?? "",
    action,
  };
  let actionError: unknown = null;
  try {
    const result = action === "delete"
      ? await admin.auth.admin.deleteUser(targetUserId)
      : await admin.auth.admin.updateUserById(targetUserId, { ban_duration: action === "ban" ? "876000h" : "none" });
    if (result.error) throw new Error("Supabase user action failed.");
  } catch (error) {
    actionError = error;
  }

  try {
    await insertAdminActionHistory(admin, record, actionError ? "failed" : "completed");
  } catch (historyError) {
    console.warn("[Supabase] User action completed or failed but no history record could be written.", historyError);
  }
  if (actionError) throw actionError;
  return { action, userId: targetUserId } as const;
}

function mapStructuredActionHistory(rows: any[]) {
  return rows.map((row: any) => ({
    id: String(row.id),
    actorEmail: row.actor_email,
    targetUserId: row.target_user_id,
    targetEmail: row.target_email,
    action: row.action as SupabaseAdminAction,
    status: row.status as AdminActionHistoryStatus,
    createdAt: new Date(row.created_at),
  }));
}

function mapAuditActionHistory(rows: any[]) {
  return rows.flatMap((row: any) => {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const action = metadata.action as SupabaseAdminAction;
    if (!["ban", "unban", "delete"].includes(action)) return [];
    return [{
      id: String(row.id),
      actorEmail: MASTER_ADMIN_EMAIL,
      targetUserId: String(metadata.targetId ?? ""),
      targetEmail: String(metadata.target ?? ""),
      action,
      status: metadata.status === "failed" ? "failed" : "completed",
      createdAt: new Date(row.created_at),
    }];
  });
}

export async function supabaseListUserActionHistory(actorId: string) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("admin_user_action_history")
    .select("id,actor_email,target_user_id,target_email,action,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error && !isMissingRelationError(error)) throw new Error("Admin action history list failed.");

  const { data: auditRows, error: auditError } = await admin
    .from("security_audit_events")
    .select("id,user_id,event_type,metadata,created_at")
    .eq("user_id", actorId)
    .eq("event_type", "admin_action")
    .order("created_at", { ascending: false })
    .limit(200);
  if (auditError) throw new Error("Admin action history list failed.");

  return [
    ...mapStructuredActionHistory(data ?? []),
    ...mapAuditActionHistory(auditRows ?? []),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function rangeQuery(query: any, range: ProcessHistoryDateRange) {
  if (range.startDate) query = query.gte("completed_at", range.startDate.toISOString());
  if (range.endDate) query = query.lte("completed_at", range.endDate.toISOString());
  return query;
}

function safeAuditMetadata(metadata?: SecurityAuditMetadata) {
  if (!metadata) return null;
  const sensitive = /file|workbook|sheet|row|cell|profile|email|phone|name|token|secret|password/i;
  const entries = Object.entries(metadata)
    .filter(([key, value]) => /^[a-z][a-zA-Z0-9_]{0,63}$/.test(key) && !sensitive.test(key) && value !== undefined && value !== null)
    .slice(0, 8)
    .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 80) : value]);
  return entries.length ? Object.fromEntries(entries) : null;
}

export async function supabaseCreateProcessHistory(record: { userId: string; toolKey: string; toolName: string; inputFileNames: string; outputFilename: string; totalRecords: number }) {
  const { error } = await requireAdmin().from("process_history").insert({
    user_id: record.userId, tool_key: record.toolKey, tool_name: record.toolName, status: "completed",
    input_file_names: record.inputFileNames, output_filename: record.outputFilename, total_records: record.totalRecords,
  });
  if (error) throw new Error("Supabase process-history write failed.");
}

export async function supabaseListProcessHistory(userId: string, range: ProcessHistoryDateRange = {}, exportAll = false) {
  let query = requireAdmin().from("process_history").select("id,user_id,tool_key,tool_name,status,input_file_names,output_filename,total_records,completed_at").eq("user_id", userId).order("completed_at", { ascending: false });
  query = rangeQuery(query, range);
  if (!exportAll) query = query.limit(50);
  const { data, error } = await query;
  if (error) throw new Error("Supabase process-history read failed.");
  return (data ?? []).map((row: any) => ({ id: row.id, userId: row.user_id, toolKey: row.tool_key, toolName: row.tool_name, status: row.status, inputFileNames: row.input_file_names, outputFilename: row.output_filename, totalRecords: row.total_records, completedAt: new Date(row.completed_at) }));
}

export async function supabaseClearProcessHistory(userId: string) {
  const { count, error } = await requireAdmin().from("process_history").delete({ count: "exact" }).eq("user_id", userId);
  if (error) throw new Error("Supabase process-history delete failed.");
  return { deletedCount: count ?? 0 };
}

export async function supabaseGetRetention(userId: string): Promise<RetentionDays> {
  const { data, error } = await requireAdmin().from("user_process_settings").select("retention_days").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Supabase retention read failed.");
  return (data?.retention_days ?? null) as RetentionDays;
}

export async function supabaseSaveRetention(userId: string, retentionDays: RetentionDays) {
  const { error } = await requireAdmin().from("user_process_settings").upsert({ user_id: userId, retention_days: retentionDays, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error("Supabase retention write failed.");
}

export async function supabaseApplyRetention(userId: string, now = new Date()) {
  const retentionDays = await supabaseGetRetention(userId);
  if (retentionDays === null) return { retentionDays, deletedCount: 0 };
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000).toISOString();
  const { count, error } = await requireAdmin().from("process_history").delete({ count: "exact" }).eq("user_id", userId).lt("completed_at", cutoff);
  if (error) throw new Error("Supabase retention cleanup failed.");
  return { retentionDays, deletedCount: count ?? 0 };
}

export async function supabaseGetProfile(userId: string): Promise<EditableUserProfile | null> {
  const { data, error } = await requireAdmin().from("user_profiles").select("encrypted_payload").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Supabase profile read failed.");
  return data ? JSON.parse(decryptProfileValue(data.encrypted_payload)) as EditableUserProfile : null;
}

export async function supabaseSaveProfile(userId: string, profile: EditableUserProfile) {
  const { error } = await requireAdmin().from("user_profiles").upsert({ user_id: userId, encrypted_payload: encryptProfileValue(JSON.stringify(profile)), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error("Supabase profile write failed.");
}

export async function supabaseDeleteProfile(userId: string) {
  const { count, error } = await requireAdmin().from("user_profiles").delete({ count: "exact" }).eq("user_id", userId);
  if (error) throw new Error("Supabase profile delete failed.");
  return { deletedCount: count ?? 0 };
}

export async function supabaseCreateAuditEvent(userId: string, eventType: string, metadata?: SecurityAuditMetadata) {
  const { error } = await requireAdmin().from("security_audit_events").insert({ user_id: userId, event_type: eventType, metadata: safeAuditMetadata(metadata) });
  if (error) throw new Error("Supabase audit write failed.");
}

export async function supabaseListAuditEvents(userId: string) {
  const { data, error } = await requireAdmin().from("security_audit_events").select("id,user_id,event_type,metadata,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Supabase audit read failed.");
  return (data ?? []).map((row: any) => ({ id: row.id, userId: row.user_id, eventType: row.event_type, metadata: row.metadata ? JSON.stringify(row.metadata) : null, createdAt: new Date(row.created_at) }));
}
