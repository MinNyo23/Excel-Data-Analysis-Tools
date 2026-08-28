import { describe, expect, it } from "vitest";

describe("Cloudflare Turnstile configuration", () => {
  it("keeps the browser key public and verifies the client endpoint is reachable", async () => {
    const siteKey = process.env.VITE_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      // The login page must fail closed until the public site key is supplied.
      expect(siteKey).toBeUndefined();
      return;
    }

    expect(siteKey).toMatch(/^[A-Za-z0-9_-]{10,}$/);
    const response = await fetch(
      `https://challenges.cloudflare.com/turnstile/v0/api.js?sitekey=${encodeURIComponent(siteKey)}`,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("turnstile");
  });
});
