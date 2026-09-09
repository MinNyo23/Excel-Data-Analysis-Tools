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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Branded OTP email aligned with the Excel Master File login UI. */
export function buildSignInOtpEmail(data: { email: string; otp: string }) {
  const safeEmail = escapeHtml(data.email.trim().toLowerCase());
  const digits = data.otp.replace(/\D/g, "").slice(0, 8).padStart(8, "0");
  const digitCells = digits
    .split("")
    .map(
      digit =>
        `<td style="width:36px;height:44px;border:1px solid #cfe1d1;border-radius:10px;background:#fbfefb;color:#0f6a51;font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:22px;font-weight:700;letter-spacing:0;text-align:center;vertical-align:middle;">${escapeHtml(digit)}</td>`,
    )
    .join('<td style="width:6px;"></td>');

  const text = [
    "Excel Master File — secure sign-in",
    "",
    `Your one-time password for ${data.email.trim().toLowerCase()} is:`,
    digits,
    "",
    "This code expires in 10 minutes and can only be used once.",
    "If you did not request this code, you can ignore this email.",
    "",
    "— Operations Toolkit · Excel Master File",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>Your Excel Master File sign-in code</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f2;color:#1d2a26;font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f2;background-image:radial-gradient(circle at 88% 5%, rgba(209,238,193,.48), transparent 28rem);">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 8px 18px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:40px;height:40px;border-radius:13px;background:#1e5d4d;color:#ffffff;font-size:18px;font-weight:800;text-align:center;vertical-align:middle;box-shadow:0 6px 16px rgba(30,93,77,.2);">◈</td>
                  <td style="padding-left:12px;">
                    <div style="color:#7c8c83;font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:9px;font-weight:800;letter-spacing:.14em;">OPERATIONS TOOLKIT</div>
                    <div style="color:#1d2923;font-size:15px;font-weight:800;letter-spacing:-.02em;">Excel Master File</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="border:1px solid #dce8dc;border-radius:24px;background:#ffffff;box-shadow:0 24px 60px rgba(20,65,45,.11);overflow:hidden;">
              <div style="height:4px;background:linear-gradient(90deg,#0b493b 0%,#0f6a51 58%,#2f8a63 100%);"></div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:32px 28px 12px;">
                    <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#e1f1d8;color:#45734e;font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:10px;font-weight:800;letter-spacing:.08em;">SECURE WORKSPACE ACCESS</div>
                    <h1 style="margin:16px 0 10px;color:#1c3528;font-size:28px;line-height:1.15;letter-spacing:-.045em;font-weight:800;">Your sign-in code</h1>
                    <p style="margin:0;color:#718077;font-size:14px;line-height:1.65;">Enter this eight-digit one-time password to reach your private Excel Master File workspace. No application password is collected.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 8px;">
                    <p style="margin:0 0 10px;color:#405649;font-size:12px;font-weight:800;">Code for ${safeEmail}</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                      <tr>${digitCells}</tr>
                    </table>
                    <p style="margin:16px 0 0;color:#0f6a51;font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:.28em;text-align:center;">${escapeHtml(digits)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d7e9d9;border-radius:12px;background:#f4faf4;">
                      <tr>
                        <td style="padding:14px 16px;color:#50665a;font-size:12px;line-height:1.55;">
                          <strong style="color:#315741;">Expires in 10 minutes</strong><br/>
                          This code can only be used once. If you did not request it, you can ignore this email — your account stays secure.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 8px 0;color:#748178;font-size:11px;line-height:1.55;text-align:center;">
              Sent by Excel Master File Tool · Operations Toolkit<br/>
              Do not forward this email. Never share your sign-in code.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: "Your Excel Master File sign-in code",
    text,
    html,
  };
}

async function deliverMail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
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
      html: options.html,
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
  const message = buildSignInOtpEmail(data);
  await deliverMail({
    to: data.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    kind: "OTP (sign-in)",
  });
}
