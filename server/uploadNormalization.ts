import { spawn } from "node:child_process";
import path from "node:path";
import type { ExcelInputFile } from "./excelProcessor.js";

type NormalizedPayload = { files: ExcelInputFile[] };

export async function normalizeUploadedFiles(files: ExcelInputFile[]): Promise<ExcelInputFile[]> {
  if (!files.some(file => file.name.toLowerCase().endsWith(".csv"))) return files;
  const scriptPath = path.resolve(process.cwd(), "scripts/normalize_upload.py");
  return new Promise((resolve, reject) => {
    const worker = spawn("python3", [scriptPath], { stdio: ["pipe", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    worker.stdout.setEncoding("utf8");
    worker.stderr.setEncoding("utf8");
    worker.stdout.on("data", chunk => { stdout += chunk; });
    worker.stderr.on("data", chunk => { stderr += chunk; });
    worker.on("error", reject);
    worker.on("close", code => {
      if (code !== 0) return reject(new Error(stderr.trim() || "CSV normalization failed."));
      try {
        const payload = JSON.parse(stdout) as NormalizedPayload;
        if (!Array.isArray(payload.files) || payload.files.length !== files.length) throw new Error("CSV normalization returned an invalid response.");
        resolve(payload.files);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("CSV normalization returned an invalid response."));
      }
    });
    worker.stdin.end(JSON.stringify({ files }));
  });
}
