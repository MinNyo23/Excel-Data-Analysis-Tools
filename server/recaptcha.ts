import type { Express, Request, Response } from "express";

const GOOGLE_RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const MAX_TOKEN_LENGTH = 4_096;

type GoogleRecaptchaResponse = {
  success?: boolean;
  hostname?: string;
  "error-codes"?: string[];
};

function configuredHostnames() {
  return (process.env.RECAPTCHA_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyGoogleRecaptchaToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret || !token || token.length > MAX_TOKEN_LENGTH) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(GOOGLE_RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) return false;
    const result = await response.json() as GoogleRecaptchaResponse;
    if (result.success !== true) return false;

    const hostnames = configuredHostnames();
    return hostnames.length === 0 || (typeof result.hostname === "string" && hostnames.includes(result.hostname.toLowerCase()));
  } catch {
    return false;
  }
}

export function registerRecaptchaRoutes(app: Express) {
  app.post("/api/auth/verify-recaptcha", async (req: Request, res: Response) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const remoteIp = typeof req.ip === "string" ? req.ip : undefined;
    const valid = await verifyGoogleRecaptchaToken(token, remoteIp);
    if (!valid) return res.status(400).json({ verified: false, error: "CAPTCHA verification failed." });
    return res.json({ verified: true });
  });
}
