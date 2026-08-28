import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyGoogleRecaptchaToken } from "./recaptcha";

describe("Google reCAPTCHA server verification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RECAPTCHA_SECRET_KEY;
    delete process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
  });

  it("fails closed when the server secret is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(verifyGoogleRecaptchaToken("token")).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a successful Google siteverify response", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "server-secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, hostname: "localhost" }), { status: 200 }));

    await expect(verifyGoogleRecaptchaToken("captcha-token", "127.0.0.1")).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith("https://www.google.com/recaptcha/api/siteverify", expect.objectContaining({ method: "POST" }));
    const request = fetchSpy.mock.calls[0]?.[1];
    expect(String(request?.body)).toContain("secret=server-secret");
    expect(String(request?.body)).toContain("response=captcha-token");
  });

  it("rejects unsuccessful responses and unexpected hostnames", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "server-secret";
    process.env.RECAPTCHA_ALLOWED_HOSTNAMES = "app.example.com";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, hostname: "attacker.example.com" }), { status: 200 }));
    await expect(verifyGoogleRecaptchaToken("captcha-token")).resolves.toBe(false);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 }));
    await expect(verifyGoogleRecaptchaToken("captcha-token")).resolves.toBe(false);
  });
});
