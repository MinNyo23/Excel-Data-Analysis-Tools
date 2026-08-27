import { describe, expect, it } from "vitest";
import { decryptProfileValue, encryptProfileValue, getProfileEncryptionKey } from "./profileEncryption";

describe("profile encryption configuration", () => {
  it("uses a valid configured key or a purpose-derived server key to round-trip profile data without storing plaintext", () => {
    expect(getProfileEncryptionKey()).toHaveLength(32);
    const encrypted = encryptProfileValue("Private profile value");
    expect(encrypted).not.toContain("Private profile value");
    expect(decryptProfileValue(encrypted)).toBe("Private profile value");
  });
});
