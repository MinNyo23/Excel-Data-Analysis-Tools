CREATE TABLE "admin_auth_settings" (
	"settingKey" varchar(64) PRIMARY KEY NOT NULL,
	"allowedEmailDomain" varchar(253) DEFAULT 'gmail.com' NOT NULL,
	"updatedBy" integer,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
