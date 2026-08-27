import * as legacy from "./db";
import * as supabase from "./supabaseIntegration";

export type MetadataUserId = number | string;
const external = (userId: MetadataUserId): userId is string => supabase.isSupabaseUserId(userId);

export const metadataStore = {
  createProcessHistory: async (record: { userId: MetadataUserId; toolKey: string; toolName: string; inputFileNames: string; outputFilename: string; totalRecords: number }) => external(record.userId) ? supabase.supabaseCreateProcessHistory(record as any) : legacy.createProcessHistory({ ...(record as any), status: "completed" }),
  listProcessHistory: (userId: MetadataUserId) => external(userId) ? supabase.supabaseListProcessHistory(userId) : legacy.listProcessHistory(userId),
  listProcessHistoryForExport: (userId: MetadataUserId, range: legacy.ProcessHistoryDateRange) => external(userId) ? supabase.supabaseListProcessHistory(userId, range, true) : legacy.listProcessHistoryForExport(userId, range),
  clearProcessHistory: (userId: MetadataUserId) => external(userId) ? supabase.supabaseClearProcessHistory(userId) : legacy.clearProcessHistory(userId),
  getRetention: (userId: MetadataUserId) => external(userId) ? supabase.supabaseGetRetention(userId) : legacy.getProcessHistoryRetention(userId),
  saveRetention: (userId: MetadataUserId, days: legacy.RetentionDays) => external(userId) ? supabase.supabaseSaveRetention(userId, days) : legacy.saveProcessHistoryRetention(userId, days),
  applyRetention: (userId: MetadataUserId) => external(userId) ? supabase.supabaseApplyRetention(userId) : legacy.applyProcessHistoryRetention(userId),
  getProfile: (userId: MetadataUserId) => external(userId) ? supabase.supabaseGetProfile(userId) : legacy.getUserProfile(userId),
  saveProfile: (userId: MetadataUserId, profile: legacy.EditableUserProfile) => external(userId) ? supabase.supabaseSaveProfile(userId, profile) : legacy.saveUserProfile(userId, profile),
  deleteProfile: (userId: MetadataUserId) => external(userId) ? supabase.supabaseDeleteProfile(userId) : legacy.deleteUserProfile(userId),
  createAuditEvent: (userId: MetadataUserId, eventType: string, metadata?: legacy.SecurityAuditMetadata) => external(userId) ? supabase.supabaseCreateAuditEvent(userId, eventType, metadata) : legacy.createSecurityAuditEvent(userId, eventType, metadata),
  listAuditEvents: (userId: MetadataUserId) => external(userId) ? supabase.supabaseListAuditEvents(userId) : legacy.getDb().then(async db => db ? legacy.listSecurityAuditEventsForUser(db, userId) : []),
};
