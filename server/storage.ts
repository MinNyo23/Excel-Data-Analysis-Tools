import fs from "node:fs/promises";
import path from "node:path";

const storageRoot = path.resolve(process.env.STORAGE_DIR ?? "./storage");

function normalizeKey(relKey: string): string {
  const normalized = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.split("/").some(part => part === "..")) throw new Error("Invalid storage key");
  return normalized;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const filePath = path.join(storageRoot, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, typeof data === "string" ? data : data);
  await fs.writeFile(`${filePath}.json`, JSON.stringify({ contentType }), "utf8");
  return { key, url: `/local-storage/${encodeURI(key)}` };
}

export async function storageGet(relKey: string) {
  const key = normalizeKey(relKey);
  return { key, url: `/local-storage/${encodeURI(key)}` };
}

export async function storageGetSignedUrl(relKey: string) {
  return (await storageGet(relKey)).url;
}
