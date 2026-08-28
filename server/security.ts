import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { GOOGLE_RECAPTCHA_ORIGINS } from "@shared/contentSecurityPolicy";
import { MAX_UPLOAD_FILE_BYTES } from "@shared/uploadLimits";

export { MAX_UPLOAD_FILE_BYTES } from "@shared/uploadLimits";
export const MAX_UPLOAD_BATCH_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 10;
const MAX_ZIP_ENTRIES = 500;
const MAX_ZIP_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 40 * 1024 * 1024;
const MAX_ZIP_COMPRESSION_RATIO = 200;

type UploadedFileLike = { name: string; data: string };

function isBase64(value: string) {
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function validateXlsxArchive(bytes: Buffer) {
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50) return "XLSX files must be valid ZIP-based workbooks.";
  if (!bytes.includes(Buffer.from("[Content_Types].xml"))) return "XLSX workbook content markers are missing.";
  const eocdOffset = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset < 0 || eocdOffset + 22 > bytes.length) return "XLSX archive directory is invalid.";
  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  const directoryOffset = bytes.readUInt32LE(eocdOffset + 16);
  if (entryCount > MAX_ZIP_ENTRIES) return "XLSX contains too many archive entries.";
  if (directoryOffset >= bytes.length) return "XLSX archive directory is out of bounds.";
  let offset = directoryOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) return "XLSX archive entry is invalid.";
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    if (uncompressedSize > MAX_ZIP_ENTRY_BYTES) return "XLSX contains an oversized archive entry.";
    if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_ZIP_COMPRESSION_RATIO) return "XLSX compression ratio is unsafe.";
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) return "XLSX expands beyond the safe processing limit.";
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return null;
}

export function validateUploadedWorkbook(file: UploadedFileLike): string | null {
  if (!file.name || file.name.length > 255 || /[\\/\0]/.test(file.name)) return "File name is invalid.";
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".csv")) return "Only CSV and XLSX files are allowed.";
  if (!isBase64(file.data)) return "File data is not valid base64.";
  const bytes = Buffer.from(file.data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_FILE_BYTES) return "File exceeds the 10 MB upload limit.";
  if (lowerName.endsWith(".csv")) {
    if (bytes.includes(0)) return "CSV files may not contain binary content.";
    return null;
  }
  return validateXlsxArchive(bytes);
}

export function validateUploadedWorkbookBatch(files: UploadedFileLike[]): string | null {
  if (files.length === 0 || files.length > MAX_UPLOAD_FILES) return `Upload between 1 and ${MAX_UPLOAD_FILES} files per request.`;
  let totalBytes = 0;
  for (const file of files) {
    const error = validateUploadedWorkbook(file);
    if (error) return `${file.name || "Upload"}: ${error}`;
    totalBytes += Buffer.from(file.data, "base64").length;
    if (totalBytes > MAX_UPLOAD_BATCH_BYTES) return "Combined upload size exceeds the 20 MB request limit.";
  }
  return null;
}

type RateLimitEntry = { startedAt: number; expiresAt: number; count: number };
const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_RATE_LIMIT_ENTRIES = 10_000;

function makeRoomForRateLimitEntry(now: number) {
  if (rateLimitStore.size < MAX_RATE_LIMIT_ENTRIES) return;
  rateLimitStore.forEach((entry, key) => {
    if (entry.expiresAt <= now) rateLimitStore.delete(key);
  });
  while (rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
    const oldestKey = rateLimitStore.keys().next().value as string | undefined;
    if (!oldestKey) return;
    rateLimitStore.delete(oldestKey);
  }
}

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const entry = rateLimitStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    makeRoomForRateLimitEntry(now);
    rateLimitStore.set(key, { startedAt: now, expiresAt: now + windowMs, count: 1 });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), retryAfterMs: Math.max(0, entry.expiresAt - now) };
}

export function requestIdentity(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const address = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim() || req.ip || "unknown";
  return createHash("sha256").update(address).digest("hex").slice(0, 24);
}

export function mutationOriginIsTrusted(req: Request) {
  if (req.method !== "POST") return true;
  const origin = req.headers.origin;
  if (!origin) return true;
  const configuredOrigins = (process.env.ALLOWED_FRONTEND_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  if (configuredOrigins.includes(origin)) return true;
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "") as string;
  const protoValue = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const proto = Array.isArray(protoValue) ? protoValue[0] : protoValue.split(",")[0];
  try { return new URL(origin).origin === `${proto.trim()}://${host}`; } catch { return false; }
}

export function externalApiCors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const configuredOrigins = (process.env.ALLOWED_FRONTEND_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  if (origin && configuredOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).end();
  }
  return next();
}

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  const isSecure = req.protocol === "https" || String(req.headers["x-forwarded-proto"] || "").split(",").some(value => value.trim() === "https");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(), display-capture=(), fullscreen=(), hid=(), serial=(), web-share=(), xr-spatial-tracking=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Origin-Agent-Cluster", "?1");
  // Public managed-storage redirects are intentionally embedded by the Vercel
  // frontend. All other application responses remain same-origin isolated.
  res.setHeader("Cross-Origin-Resource-Policy", req.path.startsWith("/manus-storage/") ? "cross-origin" : "same-origin");
  const recaptchaOrigins = GOOGLE_RECAPTCHA_ORIGINS.join(" ");
  res.setHeader("Content-Security-Policy", `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://*.manus.computer; frame-src ${recaptchaOrigins}; form-action 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' ${recaptchaOrigins}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; style-src-attr 'unsafe-inline'; connect-src 'self' https: ${recaptchaOrigins}; worker-src 'none'; media-src 'none'; manifest-src 'self'`);
  if (isSecure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
}

export function apiRequestGuards(req: Request, res: Response, next: NextFunction) {
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 30 * 1024 * 1024) return res.status(413).json({ error: "Request body is too large." });
  if (!mutationOriginIsTrusted(req)) return res.status(403).json({ error: "Untrusted request origin." });
  const limit = consumeRateLimit(`api:${requestIdentity(req)}`, 120, 60_000);
  if (!limit.allowed) {
    const retryAfterSeconds = Math.ceil(limit.retryAfterMs / 1000);
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({ error: "Too many requests. Please try again shortly.", retryAfterSeconds });
  }
  next();
}
