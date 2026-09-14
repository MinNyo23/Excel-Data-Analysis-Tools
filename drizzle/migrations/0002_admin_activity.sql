CREATE TABLE IF NOT EXISTS "admin_activity_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorEmail" varchar(320) DEFAULT '' NOT NULL,
	"targetEmail" varchar(320) DEFAULT '' NOT NULL,
	"targetUserId" varchar(64) DEFAULT '' NOT NULL,
	"action" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'completed' NOT NULL,
	"detail" varchar(253) DEFAULT '' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_activity_created_idx" ON "admin_activity_events" ("createdAt");
