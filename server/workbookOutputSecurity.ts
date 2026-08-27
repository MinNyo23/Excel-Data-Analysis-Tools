import { spawn } from "node:child_process";
import path from "node:path";

const MAX_GENERATED_WORKBOOK_BYTES = 40 * 1024 * 1024;
const MAX_GENERATED_WORKBOOK_BASE64_LENGTH = Math.ceil(MAX_GENERATED_WORKBOOK_BYTES / 3) * 4;

type WorkbookResult = { workbookBase64: string; [key: string]: unknown };

function isStrictBase64(value: string) {
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/**
 * Every generated XLSX passes through this in-memory guard before the API sends
 * it to the browser. Formula-like text from an uploaded workbook is converted
 * to a literal cell value so a later Excel download cannot evaluate it.
 */
export async function sanitizeGeneratedWorkbookOutput<T extends WorkbookResult>(result: T): Promise<T> {
  if (!isStrictBase64(result.workbookBase64) || result.workbookBase64.length > MAX_GENERATED_WORKBOOK_BASE64_LENGTH) {
    throw new Error("Generated workbook could not be prepared for download.");
  }

  const scriptPath = path.resolve(process.cwd(), "scripts/sanitize_workbook_output.py");
  const maxResponseLength = MAX_GENERATED_WORKBOOK_BASE64_LENGTH + 1_024;

  return new Promise((resolve, reject) => {
    const worker = spawn("python3", [scriptPath], { stdio: ["pipe", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let completed = false;

    const fail = () => {
      if (completed) return;
      completed = true;
      worker.kill();
      reject(new Error("Generated workbook could not be prepared for download."));
    };

    worker.stdout.setEncoding("utf8");
    worker.stdout.on("data", chunk => {
      stdout += chunk;
      if (stdout.length > maxResponseLength) fail();
    });
    worker.on("error", fail);
    worker.on("close", code => {
      if (completed) return;
      if (code !== 0) return fail();
      try {
        const payload = JSON.parse(stdout) as { workbookBase64?: unknown };
        if (typeof payload.workbookBase64 !== "string" || !isStrictBase64(payload.workbookBase64) || payload.workbookBase64.length > MAX_GENERATED_WORKBOOK_BASE64_LENGTH) return fail();
        completed = true;
        resolve({ ...result, workbookBase64: payload.workbookBase64 });
      } catch {
        fail();
      }
    });
    worker.stdin.end(JSON.stringify({ workbookBase64: result.workbookBase64 }));
  });
}
