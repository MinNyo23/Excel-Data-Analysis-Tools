import { describe, expect, it } from "vitest";

describe("Supabase split-architecture credentials", () => {
  it("authenticates a server-side metadata query without exposing secrets", async () => {
    const url = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    expect(url).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i);
    expect(serviceRoleKey).toBeTruthy();
    expect(publishableKey).toBeTruthy();

    const response = await fetch(`${url}/rest/v1/process_history?select=id&limit=1`, {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey!}`,
      },
    });

    expect(response.status).toBe(200);
  }, 15_000);

  it("uses reachable HTTPS Vercel origins for external frontend access", async () => {
    const origins = (process.env.ALLOWED_FRONTEND_ORIGINS ?? "").split(",").filter(Boolean);
    expect(origins).toHaveLength(2);
    expect(origins).toContain("https://excel-master-file-tool.vercel.app");
    for (const origin of origins) {
      expect(origin).toMatch(/^https:\/\/[-a-z0-9]+\.vercel\.app$/i);
      const response = await fetch(origin);
      expect(response.status).toBe(200);
    }
  }, 15_000);

  it("uses a reachable managed processing endpoint for the Vercel frontend", async () => {
    const apiBaseUrl = process.env.VITE_PROCESSING_API_URL;
    expect(apiBaseUrl).toMatch(/^https:\/\/[-a-z0-9.]+\.manus\.computer$/i);
    expect(process.env.VITE_USE_SUPABASE_AUTH).toBe("true");
    const response = await fetch(`${apiBaseUrl}/api/trpc/auth.me?batch=1&input=%7B%7D`);
    expect(response.status).toBe(200);
  }, 15_000);
});
