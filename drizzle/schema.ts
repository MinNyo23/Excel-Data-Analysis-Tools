import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Privacy-preserving execution history. This table intentionally stores only
 * lightweight process metadata; it never stores uploaded Excel bytes, cell
 * values, preview rows, or generated workbook data.
 */
export const processHistory = mysqlTable("process_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  toolKey: varchar("toolKey", { length: 64 }).notNull(),
  toolName: varchar("toolName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["completed"]).default("completed").notNull(),
  inputFileNames: text("inputFileNames").notNull(),
  outputFilename: varchar("outputFilename", { length: 255 }).notNull(),
  totalRecords: int("totalRecords").notNull().default(0),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
});

export type ProcessHistory = typeof processHistory.$inferSelect;
export type InsertProcessHistory = typeof processHistory.$inferInsert;

/**
 * User-editable profile details are stored as one encrypted JSON payload.
 * OAuth-synced identity fields remain on the users table and are never edited here.
 */
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  encryptedPayload: text("encryptedPayload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Per-user retention preference for privacy-preserving process metadata.
 * A null value means retain metadata until the user clears it manually.
 */
export const userProcessSettings = mysqlTable("user_process_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  retentionDays: decimal("retentionDays", { precision: 5, scale: 1 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProcessSettings = typeof userProcessSettings.$inferSelect;
export type InsertUserProcessSettings = typeof userProcessSettings.$inferInsert;

/**
 * Privacy-preserving security event log. Metadata is intentionally limited to
 * event-safe fields; never record Excel file bytes, spreadsheet rows, IPs, or
 * user-entered profile content in this table.
 */
export const securityAuditEvents = mysqlTable("security_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("security_audit_user_created_idx").on(table.userId, table.createdAt)]);

export type SecurityAuditEvent = typeof securityAuditEvents.$inferSelect;
export type InsertSecurityAuditEvent = typeof securityAuditEvents.$inferInsert;
