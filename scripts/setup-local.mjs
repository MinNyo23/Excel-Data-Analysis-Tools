import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
const examplePath = resolve(root, ".env.example");

function run(command) {
  execSync(command, { cwd: root, stdio: "inherit" });
}

function ensureEnvFile() {
  if (existsSync(envPath)) {
    console.log("[setup] .env already exists — leaving it unchanged.");
    return;
  }

  if (!existsSync(examplePath)) {
    throw new Error(".env.example is missing.");
  }

  copyFileSync(examplePath, envPath);
  const secret = randomBytes(32).toString("base64url");
  const contents = readFileSync(envPath, "utf8").replace(
    "JWT_SECRET=change-me-to-a-long-random-secret",
    `JWT_SECRET=${secret}`
  );
  writeFileSync(envPath, contents, "utf8");
  console.log("[setup] Created .env from .env.example with a generated JWT_SECRET.");
  console.log("[setup] Add your Supabase keys to .env before signing in.");
}

console.log("Excel Master File Tool — local setup\n");

const nodeVersion = process.versions.node;
const major = Number.parseInt(nodeVersion.split(".")[0] ?? "0", 10);
if (major < 20) {
  console.error(`Node.js 20+ is required (found ${nodeVersion}). Install from https://nodejs.org/`);
  process.exit(1);
}
console.log(`[setup] Node.js ${nodeVersion}`);

try {
  run("corepack enable");
} catch {
  console.warn("[setup] corepack enable failed — pnpm may still work if already installed.");
}

try {
  run("pnpm install");
} catch {
  console.error("[setup] pnpm install failed.");
  process.exit(1);
}

ensureEnvFile();

console.log("\nSetup complete. Next steps:");
console.log("  1. Edit .env and add your Supabase publishable + service-role keys.");
console.log("  2. In Supabase → Authentication → URL Configuration, add:");
console.log("       http://localhost:3000/**");
console.log("  3. Run: pnpm dev");
console.log("  4. Open: http://localhost:3000");
