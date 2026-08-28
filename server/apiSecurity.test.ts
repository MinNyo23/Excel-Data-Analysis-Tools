import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GOOGLE_RECAPTCHA_ORIGINS } from "../shared/contentSecurityPolicy";
import { redactTRPCErrorShape } from "./_core/trpc";

describe("browser and API security contracts", () => {
  it("removes internal stack, path, and validation details from public API error shapes", () => {
    const redacted = redactTRPCErrorShape({
      message: "sensitive internal failure",
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, stack: "Error: internal path", path: "profile.me", zodError: { private: true } },
    }, "INTERNAL_SERVER_ERROR");

    expect(redacted).toEqual({ message: "Request could not be completed.", data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } });
  });

  it("keeps unknown procedure names and user-editable Supabase metadata out of the authorization response path", () => {
    const notFound = redactTRPCErrorShape({ message: "No procedure found on path private.internal", data: { code: "NOT_FOUND", httpStatus: 404, path: "private.internal" } }, "NOT_FOUND");
    const supabaseAuth = readFileSync(path.resolve(process.cwd(), "server/supabaseIntegration.ts"), "utf8");

    expect(notFound).toEqual({ message: "The requested API operation was not found.", data: { code: "NOT_FOUND", httpStatus: 404 } });
    expect(supabaseAuth).toContain('from("app_user_accounts").select("role").eq("user_id", data.user.id).maybeSingle()');
    expect(supabaseAuth).not.toContain('metadata.role === "admin"');
  });

  it("exposes only a bounded retry interval for rate-limited requests", () => {
    const rateLimited = redactTRPCErrorShape({ message: "Too many requests", data: { code: "TOO_MANY_REQUESTS", httpStatus: 429, stack: "private stack" } }, "TOO_MANY_REQUESTS", { retryAfterSeconds: 42 });
    const clamped = redactTRPCErrorShape({ message: "Too many requests", data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 } }, "TOO_MANY_REQUESTS", { retryAfterSeconds: 9_999 });

    expect(rateLimited).toEqual({ message: "Too many requests", data: { code: "TOO_MANY_REQUESTS", httpStatus: 429, retryAfterSeconds: 42 } });
    expect(clamped.data.retryAfterSeconds).toBe(600);
  });

  it("defines restrictive Vercel browser headers while allowing only the configured auth and processing services", () => {
    const vercelConfig = JSON.parse(readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8"));
    const headers = vercelConfig.headers[0].headers as Array<{ key: string; value: string }>;
    const valueFor = (key: string) => headers.find(header => header.key === key)?.value ?? "";
    const csp = valueFor("Content-Security-Policy");

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain(`frame-src ${GOOGLE_RECAPTCHA_ORIGINS.join(" ")}`);
    for (const origin of GOOGLE_RECAPTCHA_ORIGINS) expect(csp).toContain(origin);
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("worker-src 'none'");
    expect(csp).toContain("https://lltzfiewqyhdbfvjqxon.supabase.co");
    expect(csp).toContain("https://3000-il1ewvzwfbgv4rg9wy6pi-abbe9b7d.us4.manus.computer");
    expect(valueFor("Access-Control-Allow-Origin")).toBe("https://excel-master-file-tool.vercel.app");
    expect(valueFor("X-Content-Type-Options")).toBe("nosniff");
    expect(valueFor("X-Frame-Options")).toBe("DENY");
    expect(valueFor("Origin-Agent-Cluster")).toBe("?1");
    expect(valueFor("X-DNS-Prefetch-Control")).toBe("off");
    expect(valueFor("Permissions-Policy")).toContain("clipboard-read=()");
    expect(valueFor("X-Permitted-Cross-Domain-Policies")).toBe("none");
  });
});
