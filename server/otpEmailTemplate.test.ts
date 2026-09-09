import { describe, expect, it } from "vitest";
import { buildSignInOtpEmail, escapeHtml } from "./mail";

describe("sign-in OTP email template", () => {
  it("renders branded HTML with the eight-digit code and site copy", () => {
    const message = buildSignInOtpEmail({ email: "User@Example.com", otp: "12345678" });

    expect(message.subject).toBe("Your Excel Master File sign-in code");
    expect(message.text).toContain("12345678");
    expect(message.text).toContain("expires in 10 minutes");
    expect(message.html).toContain("OPERATIONS TOOLKIT");
    expect(message.html).toContain("Excel Master File");
    expect(message.html).toContain("SECURE WORKSPACE ACCESS");
    expect(message.html).toContain("user@example.com");
    expect(message.html).toContain("12345678");
    expect(message.html).toContain("#0f6a51");
    expect(message.html).toContain("Expires in 10 minutes");
  });

  it("escapes untrusted email content in HTML", () => {
    expect(escapeHtml(`a<b>"c"`)).toBe("a&lt;b&gt;&quot;c&quot;");
    const message = buildSignInOtpEmail({ email: `evil<script>@example.com`, otp: "00001111" });
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("evil&lt;script&gt;@example.com");
  });
});
