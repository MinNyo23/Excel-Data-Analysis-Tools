import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../shared/appVersion";
import { notesForVersion, RELEASE_NOTES } from "../shared/whatsNew";

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("admin activity log and processing stages", () => {
  it("creates the admin activity table when it is missing", () => {
    const db = source("server/db.ts");
    expect(db).toContain('CREATE TABLE IF NOT EXISTS "admin_activity_events"');
    expect(db).toContain("recordAdminActivitySafe");
    expect(db).toContain("listAdminActivityEvents");
  });

  it("records email-domain saves, failed logins, and local ban attempts", () => {
    expect(source("server/admin.ts")).toContain('action: "email_policy"');
    expect(source("server/admin.ts")).toContain("listAdminActivityEvents");
    expect(source("server/localOtpAuth.ts")).toContain('action: "login_failed"');
  });

  it("shows staged processing status instead of a spinner only", () => {
    const progress = source("client/src/components/WorkflowProgress.tsx");
    expect(progress).toContain("Reading files");
    expect(progress).toContain("Matching records");
    expect(progress).toContain("Building Excel");
    expect(source("client/src/pages/Home.tsx")).toContain("WorkflowProgress");
    expect(source("client/src/components/PairedFileUploadPanel.tsx")).toContain("ProcessButtonContent");
    expect(source("client/src/components/ConditionalFileComparisonPanel.tsx")).toContain("WorkflowProgress");
  });

  it("ties What’s new notes to the current app version", () => {
    expect(APP_VERSION).toBe("1.0.2");
    expect(notesForVersion(APP_VERSION).version).toBe(APP_VERSION);
    expect(RELEASE_NOTES[0]?.version).toBe(APP_VERSION);
    expect(source("package.json")).toContain('"version": "1.0.2"');
  });
});
