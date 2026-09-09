import { describe, expect, it } from "vitest";
import { listSecurityAuditEventsForUser, sanitizeSecurityAuditMetadata, secureDatabaseConnectionOptions } from "./db";
import { GOOGLE_RECAPTCHA_ORIGINS } from "../shared/contentSecurityPolicy";
import { consumeRateLimit, externalApiCors, mutationOriginIsTrusted, noStoreApiResponse, securityHeaders, validateUploadedWorkbook, validateUploadedWorkbookBatch } from "./security";
import { uploadedFile } from "./routers";
import { getSessionCookieOptions } from "./_core/cookies";
import { SESSION_MAX_AGE_MS } from "../shared/const";
import { getWorkbookSelectionError, isSupportedWorkbookFileName, MAX_UPLOAD_FILE_BYTES } from "../shared/uploadLimits";
import * as XLSX from "xlsx";

function minimalXlsxBase64() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Name"], ["Sample"]]), "Sheet1");
  return (XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer).toString("base64");
}

function containsValue(value: unknown, target: unknown, seen = new Set<unknown>()): boolean {
  if (value === target) return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value as Record<string, unknown>).some(child => containsValue(child, target, seen));
}

describe("application security controls", () => {
  it("accepts only safe CSV/XLSX uploads and rejects invalid extensions or binary CSV content", () => {
    expect(isSupportedWorkbookFileName("source.CSV")).toBe(true);
    expect(isSupportedWorkbookFileName("source.XLSX")).toBe(true);
    expect(isSupportedWorkbookFileName("source.xls")).toBe(false);
    expect(isSupportedWorkbookFileName("source.pdf")).toBe(false);
    expect(getWorkbookSelectionError({ name: "source.xlsx", size: MAX_UPLOAD_FILE_BYTES })).toBeNull();
    expect(getWorkbookSelectionError({ name: "too-large.xlsx", size: MAX_UPLOAD_FILE_BYTES + 1 })).toBe("too-large.xlsx is too large. Choose a file no larger than 10 MB.");
    expect(getWorkbookSelectionError({ name: "source.pdf", size: 10 })).toMatch(/Only CSV and XLSX/);
    expect(validateUploadedWorkbook({ name: "source.xlsx", data: minimalXlsxBase64() })).toBeNull();
    expect(validateUploadedWorkbook({ name: "source.csv", data: Buffer.from("Name,Entity\nA,One\n").toString("base64") })).toBeNull();
    expect(validateUploadedWorkbook({ name: "source.xls", data: minimalXlsxBase64() })).toMatch(/Only CSV and XLSX/);
    expect(validateUploadedWorkbook({ name: "../source.xlsx", data: minimalXlsxBase64() })).toMatch(/File name/);
    expect(validateUploadedWorkbook({ name: "source.csv", data: Buffer.from([0x41, 0x00, 0x42]).toString("base64") })).toMatch(/binary/);
    expect(uploadedFile.safeParse({ name: "source.exe", data: minimalXlsxBase64() }).success).toBe(false);
  });

  it("rejects invalid XLSX payloads and oversized upload batches", () => {
    expect(validateUploadedWorkbook({ name: "broken.xlsx", data: Buffer.from("not-a-workbook").toString("base64") })).toMatch(/valid ZIP/);
    const csv = { name: "source.csv", data: Buffer.from("A\n1\n").toString("base64") };
    expect(validateUploadedWorkbookBatch(Array.from({ length: 11 }, () => csv))).toMatch(/between 1 and 10/);
  });

  it("enforces deterministic rate limits without storing raw addresses", () => {
    expect(consumeRateLimit("test-user", 2, 60_000, 1_000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(consumeRateLimit("test-user", 2, 60_000, 1_001)).toMatchObject({ allowed: true, remaining: 0 });
    expect(consumeRateLimit("test-user", 2, 60_000, 1_002)).toMatchObject({ allowed: false, remaining: 0 });
    expect(consumeRateLimit("test-user", 2, 60_000, 61_001)).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("accepts same-origin mutations and rejects cross-origin mutation requests", () => {
    const trusted = { method: "POST", protocol: "https", headers: { origin: "https://example.test", host: "example.test" } } as any;
    const untrusted = { method: "POST", protocol: "https", headers: { origin: "https://attacker.test", host: "example.test" } } as any;
    expect(mutationOriginIsTrusted(trusted)).toBe(true);
    expect(mutationOriginIsTrusted(untrusted)).toBe(false);
  });

  it("marks auth API responses as uncachable", () => {
    const headers = new Map<string, unknown>();
    noStoreApiResponse({} as any, { setHeader: (name: string, value: unknown) => headers.set(name, value) } as any, () => undefined);
    expect(headers.get("Cache-Control")).toBe("no-store, no-cache, max-age=0, must-revalidate");
    expect(headers.get("Pragma")).toBe("no-cache");
  });

  it("allows the production frontend to call auth.me with a bearer token", () => {
    const headers = new Map<string, unknown>();
    let continued = false;
    const response = { setHeader: (name: string, value: unknown) => headers.set(name, value), status: (code: number) => ({ end: () => code }) } as any;
    externalApiCors({ method: "OPTIONS", headers: { origin: "https://excel-master-file-tool.vercel.app" } } as any, response, () => { continued = true; });
    expect(headers.get("Access-Control-Allow-Origin")).toBe("https://excel-master-file-tool.vercel.app");
    expect(headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(continued).toBe(false);
  });

  it("sets defensive browser headers and no-store API responses", () => {
    const headers = new Map<string, unknown>();
    let continued = false;
    securityHeaders({ path: "/api/trpc", protocol: "https", headers: {} } as any, { setHeader: (name: string, value: unknown) => headers.set(name, value) } as any, () => { continued = true; });
    expect(continued).toBe(true);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-DNS-Prefetch-Control")).toBe("off");
    expect(headers.get("X-Download-Options")).toBe("noopen");
    expect(headers.get("Origin-Agent-Cluster")).toBe("?1");
    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(String(headers.get("Content-Security-Policy"))).toContain("object-src 'none'");
    expect(String(headers.get("Content-Security-Policy"))).toContain("script-src-attr 'none'");
    for (const origin of GOOGLE_RECAPTCHA_ORIGINS) expect(String(headers.get("Content-Security-Policy"))).toContain(origin);
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
  });

  it("permits cross-origin embedding only for the public managed-storage redirect", () => {
    const storageHeaders = new Map<string, unknown>();
    securityHeaders({ path: "/manus-storage/end-user-journey-flow_7a1b9923.webp", protocol: "https", headers: {} } as any, { setHeader: (name: string, value: unknown) => storageHeaders.set(name, value) } as any, () => undefined);
    expect(storageHeaders.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");

    const applicationHeaders = new Map<string, unknown>();
    securityHeaders({ path: "/", protocol: "https", headers: {} } as any, { setHeader: (name: string, value: unknown) => applicationHeaders.set(name, value) } as any, () => undefined);
    expect(applicationHeaders.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });

  it("keeps security-audit metadata free from profile, file, and token content", () => {
    expect(sanitizeSecurityAuditMetadata({ workflow: "ready-upload", recordCount: 2, fileName: "private.xlsx", profileValue: "private", token: "secret" })).toBe('{"workflow":"ready-upload","recordCount":2}');
  });

  it("retrieves security activity only with the signed-in user's database scope", async () => {
    let condition: unknown;
    const db = { select: () => ({ from: () => ({ where: (received: unknown) => ({ orderBy: () => ({ limit: async () => { condition = received; return []; } }) }) }) }) };
    await listSecurityAuditEventsForUser(db as any, 42);
    expect(containsValue(condition, "userId")).toBe(true);
    expect(containsValue(condition, 42)).toBe(true);
  });

  it("requires TLS with certificate validation for remote production databases", () => {
    expect(secureDatabaseConnectionOptions("mysql://user:pass@db.example.test:4000/app", "production")).toMatchObject({ connectionLimit: 5, connectTimeout: 10_000, enableKeepAlive: true, ssl: { rejectUnauthorized: true } });
    expect(secureDatabaseConnectionOptions("mysql://user:pass@localhost:3306/app", "production")).not.toHaveProperty("ssl");
    expect(() => secureDatabaseConnectionOptions("not-a-url", "production")).toThrow("Database connection URL is invalid.");
    expect(secureDatabaseConnectionOptions(undefined, "development")).toBeNull();
    expect(() => secureDatabaseConnectionOptions(undefined, "production")).toThrow("Database configuration is required in production.");
  });

  it("uses a 24-hour secure, HTTP-only, same-site-lax application session cookie", () => {
    const options = getSessionCookieOptions({ protocol: "https", headers: {} } as any);
    expect(SESSION_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  });
});
