import { describe, expect, it } from "vitest";
import { listSecurityAuditEventsForUser, sanitizeSecurityAuditMetadata, secureDatabaseConnectionOptions } from "./db";
import { consumeRateLimit, mutationOriginIsTrusted, securityHeaders, validateUploadedWorkbook, validateUploadedWorkbookBatch } from "./security";
import { uploadedFile } from "./routers";
import { getSessionCookieOptions } from "./_core/cookies";
import { SESSION_MAX_AGE_MS } from "../shared/const";

function safeXlsxBase64(entryCount = 1) {
  const local = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const name = Buffer.from("[Content_Types].xml");
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt32LE(32, 20);
  central.writeUInt32LE(64, 24);
  central.writeUInt16LE(name.length, 28);
  name.copy(central, 46);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(4, 16);
  return Buffer.concat([local, central, eocd]).toString("base64");
}

function containsValue(value: unknown, target: unknown, seen = new Set<unknown>()): boolean {
  if (value === target) return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value as Record<string, unknown>).some(child => containsValue(child, target, seen));
}

describe("application security controls", () => {
  it("accepts only safe CSV/XLSX uploads and rejects invalid extensions or binary CSV content", () => {
    expect(validateUploadedWorkbook({ name: "source.xlsx", data: safeXlsxBase64() })).toBeNull();
    expect(validateUploadedWorkbook({ name: "source.csv", data: Buffer.from("Name,Entity\nA,One\n").toString("base64") })).toBeNull();
    expect(validateUploadedWorkbook({ name: "source.xls", data: safeXlsxBase64() })).toMatch(/Only CSV and XLSX/);
    expect(validateUploadedWorkbook({ name: "../source.xlsx", data: safeXlsxBase64() })).toMatch(/File name/);
    expect(validateUploadedWorkbook({ name: "source.csv", data: Buffer.from([0x41, 0x00, 0x42]).toString("base64") })).toMatch(/binary/);
    expect(uploadedFile.safeParse({ name: "source.exe", data: safeXlsxBase64() }).success).toBe(false);
  });

  it("rejects suspicious XLSX archive counts and oversized upload batches", () => {
    expect(validateUploadedWorkbook({ name: "many.xlsx", data: safeXlsxBase64(501) })).toMatch(/too many archive entries/);
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

  it("sets defensive browser headers and no-store API responses", () => {
    const headers = new Map<string, unknown>();
    let continued = false;
    securityHeaders({ path: "/api/trpc", protocol: "https", headers: {} } as any, { setHeader: (name: string, value: unknown) => headers.set(name, value) } as any, () => { continued = true; });
    expect(continued).toBe(true);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(String(headers.get("Content-Security-Policy"))).toContain("object-src 'none'");
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
