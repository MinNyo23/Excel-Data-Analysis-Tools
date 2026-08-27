import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { decryptProfileValue, encryptProfileValue } from "./profileEncryption";
import type { EditableUserProfile, ProcessHistoryDateRange, RetentionDays, SecurityAuditMetadata } from "./db";

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
  const metadata = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    openId: data.user.id,
    name: typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null,
    email: data.user.email ?? null,
    role: metadata.role === "admin" ? "admin" : "user",
    authProvider: "supabase",
  };
}

function requireAdmin() {
  if (!supabaseAdmin) throw new Error("Supabase server integration is not configured.");
  return supabaseAdmin;
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
