import { describe, expect, it } from "vitest";

describe("Supabase SMTP configuration note", () => {
  it("is never reflected by the unauthenticated auth endpoint", async () => {
    const configurationNote = process.env.SMTP_CONFIGURATION_NOTE;
    expect(configurationNote).toBe("Gmail custom SMTP verified; passwordless email received; App Password managed in Supabase");

    const response = await fetch("http://127.0.0.1:3000/api/trpc/auth.me", {
      headers: { "x-smtp-configuration-note": configurationNote },
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain(configurationNote);
    expect(body).toContain("null");
  });
});
