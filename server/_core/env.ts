function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/** Lazy reads so values resolve after dotenv.config() (ESM imports hoist before module body). */
export const ENV = {
  get appId() {
    return env("VITE_APP_ID");
  },
  get cookieSecret() {
    return env("JWT_SECRET");
  },
  get databaseUrl() {
    return env("POSTGRES_URL") || env("DATABASE_URL");
  },
  get oAuthServerUrl() {
    return env("OAUTH_SERVER_URL");
  },
  get ownerOpenId() {
    return env("OWNER_OPEN_ID");
  },
  get adminEmails() {
    return env("ADMIN_EMAILS");
  },
  get isProduction() {
    return env("NODE_ENV") === "production";
  },
  get storageDir() {
    return env("STORAGE_DIR", "./storage");
  },
  // Optional integrations retained for isolated legacy utilities; core routing does not call them.
  get forgeApiUrl() {
    return env("BUILT_IN_FORGE_API_URL");
  },
  get forgeApiKey() {
    return env("BUILT_IN_FORGE_API_KEY");
  },
  // App-level SMTP (local / non-Supabase passwordless OTP). Same ICT mailbox pattern as employee-portal.
  get smtpHost() {
    return env("SMTP_HOST");
  },
  get smtpPort() {
    return env("SMTP_PORT", "587");
  },
  get smtpUser() {
    return env("SMTP_USER");
  },
  get smtpPass() {
    return env("SMTP_PASS");
  },
  get smtpFrom() {
    return env("SMTP_FROM");
  },
};
