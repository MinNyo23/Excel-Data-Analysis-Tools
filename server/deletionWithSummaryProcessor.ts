import { spawn } from "node:child_process";
import path from "node:path";

export type DeletionWithSummaryResult = { outputFilename: string; sheetNames: string[]; sourceSheetCount: number; entityCount: number; summary: { columns: string[]; rows: unknown[][] }; workbookBase64: string };
export function processDeletionWithSummary(file: { name: string; data: string }): Promise<DeletionWithSummaryResult> {
  const script = path.resolve(process.cwd(), "scripts/process_deletion_with_summary.py");
  return new Promise((resolve, reject) => {
    const worker = spawn("python3", [script], { stdio: ["pipe", "pipe", "pipe"], env: process.env }); let out = ""; let err = "";
    worker.stdout.setEncoding("utf8"); worker.stderr.setEncoding("utf8"); worker.stdout.on("data", chunk => out += chunk); worker.stderr.on("data", chunk => err += chunk);
    worker.on("error", reject); worker.on("close", code => { if (code !== 0) return reject(new Error(err || "Entity summary worker failed")); try { resolve(JSON.parse(out)); } catch { reject(new Error("Could not parse entity summary response")); } });
    worker.stdin.end(JSON.stringify({ file }));
  });
}

