import { and, desc, eq, gte, lt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertProcessHistory, InsertUser, processHistory, securityAuditEvents, userProcessSettings, userProfiles, users } from "../drizzle/schema.js";
import { decryptProfileValue, encryptProfileValue } from "./profileEncryption.js";
import { ENV } from './_core/env.js';

let _db: ReturnType<typeof drizzle> | null = null;

function isLocalDatabaseHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function secureDatabaseConnectionOptions(databaseUrl: string | undefined, environment = process.env.NODE_ENV ?? "development") {
  if (!databaseUrl) {
    if (environment === "production") throw new Error("Database configuration is required in production.");
    return null;
  }
  let hostname: string;
  try { hostname = new URL(databaseUrl).hostname; } catch { throw new Error("Database connection URL is invalid."); }
  const remoteProductionDatabase = environment === "production" && !isLocalDatabaseHost(hostname);
  return {
    uri: databaseUrl,
    connectionLimit: 5,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    ...(remoteProductionDatabase ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    try {
      const connection = secureDatabaseConnectionOptions(process.env.DATABASE_URL);
      if (!connection) return null;
      _db = drizzle({ connection });
    } catch {
      console.warn("[Database] Connection could not be initialized.");
      _db = null;
      if (process.env.NODE_ENV === "production") throw new Error("Database initialization failed.");
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user.");
    throw error;
  }
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("User database is unavailable");
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function listAllProcessHistory() {
  const db = await getDb();
  if (!db) throw new Error("Process history database is unavailable");
  return db.select().from(processHistory).orderBy(desc(processHistory.completedAt));
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createProcessHistory(record: InsertProcessHistory) {
  const db = await getDb();
  if (!db) throw new Error("Process history database is unavailable");
  await db.insert(processHistory).values(record);
}

export type ProcessHistoryDateRange = { startDate?: Date; endDate?: Date };

function processHistoryConditions(userId: number, range: ProcessHistoryDateRange) {
  const conditions = [eq(processHistory.userId, userId)];
  if (range.startDate) conditions.push(gte(processHistory.completedAt, range.startDate));
  if (range.endDate) conditions.push(lte(processHistory.completedAt, range.endDate));
  return and(...conditions);
}

export async function listProcessHistory(userId: number, range: ProcessHistoryDateRange = {}) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(processHistory).where(processHistoryConditions(userId, range)).orderBy(desc(processHistory.completedAt)).limit(50);
}

export async function listProcessHistoryForExport(userId: number, range: ProcessHistoryDateRange = {}) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(processHistory).where(processHistoryConditions(userId, range)).orderBy(desc(processHistory.completedAt));
}

export async function clearProcessHistory(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Process history database is unavailable");
  const result = await deleteProcessHistoryForUser(db, userId);
  return { deletedCount: Number(result[0]?.affectedRows ?? 0) };
}

export function deleteProcessHistoryForUser(db: { delete: (table: typeof processHistory) => { where: (condition: any) => any } }, userId: number) {
  return db.delete(processHistory).where(eq(processHistory.userId, userId));
}

export const RETENTION_DAYS_OPTIONS = [0.5, 1, 5, 7, 30, 90, 180, 365] as const;
export type RetentionDays = typeof RETENTION_DAYS_OPTIONS[number] | null;

export function retentionCutoffDate(retentionDays: RetentionDays, now = new Date()) {
  if (retentionDays === null) return null;
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export async function getProcessHistoryRetention(userId: number): Promise<RetentionDays> {
  const db = await getDb();
  if (!db) throw new Error("Process history database is unavailable");
  const result = await db.select().from(userProcessSettings).where(eq(userProcessSettings.userId, userId)).limit(1);
  const stored = result[0]?.retentionDays;
  return stored === null || stored === undefined ? null : Number(stored) as RetentionDays;
}

export async function saveProcessHistoryRetention(userId: number, retentionDays: RetentionDays) {
  const db = await getDb();
  if (!db) throw new Error("Process history database is unavailable");
  await db.insert(userProcessSettings).values({ userId, retentionDays: retentionDays === null ? null : String(retentionDays) }).onDuplicateKeyUpdate({
    set: { retentionDays: retentionDays === null ? null : String(retentionDays), updatedAt: new Date() },
  });
}

export async function applyProcessHistoryRetention(userId: number, now = new Date()) {
  const retentionDays = await getProcessHistoryRetention(userId);
  const cutoff = retentionCutoffDate(retentionDays, now);
  if (!cutoff) return { retentionDays, deletedCount: 0 };
  const db = await getDb();
  if (!db) throw new Error("Process history database is unavailable");
  const result = await deleteExpiredProcessHistoryForUser(db, userId, cutoff);
  return { retentionDays, deletedCount: Number(result[0]?.affectedRows ?? 0) };
}

export function deleteExpiredProcessHistoryForUser(db: { delete: (table: typeof processHistory) => { where: (condition: any) => any } }, userId: number, cutoff: Date) {
  return db.delete(processHistory).where(and(eq(processHistory.userId, userId), lt(processHistory.completedAt, cutoff)));
}

export type EditableUserProfile = {
  displayName: string;
  phoneNumber: string;
  organization: string;
  jobTitle: string;
};

export async function getUserProfile(userId: number): Promise<EditableUserProfile | null> {
  const db = await getDb();
  if (!db) throw new Error("Profile database is unavailable");
  const result = await selectUserProfileForUser(db, userId);
  const row = result[0];
  if (!row) return null;
  return JSON.parse(decryptProfileValue(row.encryptedPayload)) as EditableUserProfile;
}

export function selectUserProfileForUser(db: { select: () => { from: (table: typeof userProfiles) => { where: (condition: any) => { limit: (limit: number) => Promise<Array<{ encryptedPayload: string }>> } } } }, userId: number) {
  return db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
}

export async function saveUserProfile(userId: number, profile: EditableUserProfile) {
  const db = await getDb();
  if (!db) throw new Error("Profile database is unavailable");
  const encryptedPayload = encryptProfileValue(JSON.stringify(profile));
  await db.insert(userProfiles).values({ userId, encryptedPayload }).onDuplicateKeyUpdate({
    set: { encryptedPayload, updatedAt: new Date() },
  });
}

export async function deleteUserProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Profile database is unavailable");
  const result = await deleteUserProfileForUser(db, userId);
  return { deletedCount: Number(result[0]?.affectedRows ?? 0) };
}

export function deleteUserProfileForUser(db: { delete: (table: typeof userProfiles) => { where: (condition: any) => any } }, userId: number) {
  return db.delete(userProfiles).where(eq(userProfiles.userId, userId));
}

const auditSensitiveKey = /file|workbook|sheet|row|cell|profile|email|phone|name|token|secret|password/i;
export type SecurityAuditMetadata = Record<string, string | number | boolean | null | undefined>;

export function sanitizeSecurityAuditMetadata(metadata?: SecurityAuditMetadata) {
  if (!metadata) return null;
  const safeEntries = Object.entries(metadata)
    .filter(([key, value]) => /^[a-z][a-zA-Z0-9_]{0,63}$/.test(key) && !auditSensitiveKey.test(key) && value !== undefined && value !== null)
    .slice(0, 8)
    .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 80) : value] as const);
  return safeEntries.length ? JSON.stringify(Object.fromEntries(safeEntries)) : null;
}

export async function createSecurityAuditEvent(userId: number, eventType: string, metadata?: SecurityAuditMetadata) {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(eventType)) throw new Error("Security audit event type is invalid");
  const db = await getDb();
  if (!db) return;
  await db.insert(securityAuditEvents).values({ userId, eventType, metadata: sanitizeSecurityAuditMetadata(metadata) });
}

export function listSecurityAuditEventsForUser(db: { select: () => { from: (table: typeof securityAuditEvents) => { where: (condition: any) => { orderBy: (order: any) => { limit: (limit: number) => any } } } } }, userId: number) {
  return db.select().from(securityAuditEvents).where(eq(securityAuditEvents.userId, userId)).orderBy(desc(securityAuditEvents.createdAt)).limit(50);
}
