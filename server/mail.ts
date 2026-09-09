import nodemailer, { type Transporter } from "nodemailer";
import { ENV } from "./_core/env.js";
import { normalizeRecipient, parseMailboxAddress } from "./mail-address.js";

let transporter: Transporter | null = null;

export function smtpConfigured(): boolean {
  return Boolean(ENV.smtpHost && ENV.smtpUser && ENV.smtpPass && ENV.smtpFrom);
}

function mailboxFromAddress(): string {
  return parseMailboxAddress(ENV.smtpUser);
}

function mailboxFromHeader(): string {
  const fromAddress = parseMailboxAddress(ENV.smtpFrom);
  const authAddress = mailboxFromAddress();
  if (fromAddress !== authAddress) {
    console.warn(
      `[mail] SMTP_FROM address (${fromAddress}) differs from SMTP_USER (${authAddress}). Office 365 may reject or quarantine internal mail. Use the same mailbox in both.`
    );
  }
  return fromAddress;
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const port = Number(ENV.smtpPort || 587);
  transporter = nodemailer.createTransport({
    host: ENV.smtpHost,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
    tls: { minVersion: "TLSv1.2" },
  });

  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function deliverMail(options: {
  to: string;
  subject: string;
  text: string;
  kind: string;
}): Promise<void> {
  if (!smtpConfigured()) {
    console.info(`[mail] ${options.kind} for ${options.to} (SMTP not configured):\n${options.text}`);
    return;
  }

  const to = normalizeRecipient(options.to);
  const envelopeFrom = mailboxFromAddress();
  mailboxFromHeader();

  try {
    const info = await getTransporter().sendMail({
      from: ENV.smtpFrom,
      to,
      replyTo: envelopeFrom,
      envelope: {
        from: envelopeFrom,
        to: [to],
      },
      subject: options.subject,
      text: options.text,
      html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(options.text)}</pre>`,
    });

    const accepted = info.accepted?.map(String).join(", ") || to;
    const rejected = info.rejected?.map(String) ?? [];
    console.info(
      `[mail] Sent ${options.kind} to ${to} id=${info.messageId ?? "n/a"} accepted=[${accepted}] response=${info.response ?? "n/a"}`
    );

    if (rejected.length > 0) {
      throw new Error(`SMTP rejected recipient(s): ${rejected.join(", ")}`);
    }
  } catch (err) {
    console.error(`[mail] Failed to send ${options.kind} to ${to}`, err);
    const detail = err instanceof Error ? err.message : "Unknown SMTP error";
    throw new Error(
      `Failed to send email (${options.kind}): ${detail}. For @punhlainghospitals.com mailboxes, ask IT to check Exchange quarantine and message trace for ${envelopeFrom} → ${to}.`
    );
  }
}

export async function sendSignInOtpEmail(data: { email: string; otp: string }): Promise<void> {
  await deliverMail({
    to: data.email,
    subject: "Your Excel Master File sign-in code",
    text: `Your verification code is: ${data.otp}\n\nThis code expires in 10 minutes.`,
    kind: "OTP (sign-in)",
  });
}
