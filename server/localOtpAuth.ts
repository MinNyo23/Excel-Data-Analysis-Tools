import { createHash, randomInt } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { isEmailAllowedForDomain } from "../shared/authPolicy.js";
import { ENV } from "./_core/env.js";
import * as db from "./db.js";
import { sendSignInOtpEmail } from "./mail.js";
import { supabaseGetAllowedEmailDomain } from "./supabaseIntegration.js";
import { verifyGoogleRecaptchaToken } from "./recaptcha.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
export const LOCAL_SESSION_APP_ID = "excel-local";

type PendingOtp = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
};

const pendingOtps = new Map<string, PendingOtp>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOtp(email: string, code: string): string {
  return createHash("sha256").update(`${email}:${code}:${ENV.cookieSecret}`).digest("hex");
}

export function localOpenIdForEmail(email: string): string {
  const digest = createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 48);
  return `local_${digest}`;
}

function generateOtpCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

export async function requestLocalSignInOtp(input: {
  email: string;
  captchaToken?: string;
  remoteIp?: string;
}): Promise<{ ok: true }> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Enter a valid work email address." });
  }

  const allowedDomain = await supabaseGetAllowedEmailDomain();
  if (!isEmailAllowedForDomain(email, allowedDomain)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Only email addresses ending in @${allowedDomain} can sign in.`,
    });
  }

  const captchaRequired = Boolean(process.env.RECAPTCHA_SECRET_KEY?.trim() && process.env.VITE_RECAPTCHA_SITE_KEY?.trim());
  if (captchaRequired) {
    const token = input.captchaToken?.trim() ?? "";
    const valid = await verifyGoogleRecaptchaToken(token, input.remoteIp);
    if (!valid) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "CAPTCHA verification failed. Please complete the check again." });
    }
  }

  const existing = pendingOtps.get(email);
  const now = Date.now();
  if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Please wait ${retryAfterSeconds}s before requesting another code.`,
      cause: { retryAfterSeconds },
    });
  }

  const code = generateOtpCode();
  pendingOtps.set(email, {
    codeHash: hashOtp(email, code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  });

  try {
    await sendSignInOtpEmail({ email, otp: code });
  } catch (error) {
    pendingOtps.delete(email);
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: error instanceof Error ? error.message : "Failed to send sign-in email.",
    });
  }

  return { ok: true };
}

export async function verifyLocalSignInOtp(input: {
  email: string;
  otp: string;
}): Promise<{ openId: string; name: string; email: string }> {
  const email = normalizeEmail(input.email);
  const otp = input.otp.trim();
  if (!/^\d{8}$/.test(otp)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Enter the eight-digit code from your email." });
  }

  const allowedDomain = await supabaseGetAllowedEmailDomain();
  if (!isEmailAllowedForDomain(email, allowedDomain)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Only email addresses ending in @${allowedDomain} can sign in.`,
    });
  }

  const pending = pendingOtps.get(email);
  const now = Date.now();
  if (!pending || pending.expiresAt <= now) {
    pendingOtps.delete(email);
    throw new TRPCError({ code: "UNAUTHORIZED", message: "That code is invalid or expired. Request a new code and try again." });
  }

  if (pending.attempts >= MAX_VERIFY_ATTEMPTS) {
    pendingOtps.delete(email);
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many invalid attempts. Request a new code and try again." });
  }

  if (pending.codeHash !== hashOtp(email, otp)) {
    pending.attempts += 1;
    pendingOtps.set(email, pending);
    throw new TRPCError({ code: "UNAUTHORIZED", message: "That code is invalid or expired. Request a new code and try again." });
  }

  pendingOtps.delete(email);

  const openId = localOpenIdForEmail(email);
  const name = email.split("@")[0] || email;
  const signedInAt = new Date();

  await db.upsertUser({
    openId,
    name,
    email,
    loginMethod: "email-otp",
    lastSignedIn: signedInAt,
  });

  const signedInUser = await db.getUserByOpenId(openId);
  if (signedInUser) {
    try {
      await db.createSecurityAuditEvent(signedInUser.id, "session_login", { provider: "email-otp" });
    } catch {
      console.warn("[SecurityAudit] Login event was not recorded.");
    }
  }

  return { openId, name, email };
}
