import { index, integer, numeric, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).$type<"user" | "admin">().default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const processHistory = pgTable("process_history", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  toolKey: varchar("toolKey", { length: 64 }).notNull(),
  toolName: varchar("toolName", { length: 128 }).notNull(),
  status: varchar("status", { length: 16 }).default("completed").notNull(),
  inputFileNames: text("inputFileNames").notNull(),
  outputFilename: varchar("outputFilename", { length: 255 }).notNull(),
  totalRecords: integer("totalRecords").notNull().default(0),
  completedAt: timestamp("completedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ProcessHistory = typeof processHistory.$inferSelect;
export type InsertProcessHistory = typeof processHistory.$inferInsert;

export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  encryptedPayload: text("encryptedPayload").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

export const userProcessSettings = pgTable("user_process_settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  retentionDays: numeric("retentionDays", { precision: 5, scale: 1 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type UserProcessSettings = typeof userProcessSettings.$inferSelect;
export type InsertUserProcessSettings = typeof userProcessSettings.$inferInsert;

export const securityAuditEvents = pgTable("security_audit_events", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("security_audit_user_created_idx").on(table.userId, table.createdAt)]);

export type SecurityAuditEvent = typeof securityAuditEvents.$inferSelect;
export type InsertSecurityAuditEvent = typeof securityAuditEvents.$inferInsert;
