import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";

export function getProfileEncryptionKey() {
  const encodedKey = process.env.PROFILE_ENCRYPTION_KEY;
  if (encodedKey) {
    const key = Buffer.from(encodedKey, "base64");
    if (key.length === 32) return key;
  }

  const serverSecret = process.env.JWT_SECRET;
  if (!serverSecret) throw new Error("Profile encryption is not configured");
  return Buffer.from(hkdfSync("sha256", Buffer.from(serverSecret, "utf8"), Buffer.from("excel-master-file-tool"), Buffer.from("profile-encryption-v1"), 32));
}

export function encryptProfileValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getProfileEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptProfileValue(payload: string) {
  const [version, ivEncoded, authTagEncoded, ciphertextEncoded, ...extra] = payload.split(":");
  if (version !== VERSION || !ivEncoded || !authTagEncoded || !ciphertextEncoded || extra.length > 0) {
    throw new Error("Invalid encrypted profile value");
  }
  const decipher = createDecipheriv("aes-256-gcm", getProfileEncryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
}
