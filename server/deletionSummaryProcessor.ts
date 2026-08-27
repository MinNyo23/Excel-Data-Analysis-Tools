import { spawn } from "node:child_process";
import path from "node:path";

export type DeletionSummaryInput = { name: string; data: string };
export type DeletionSummaryResult = {
  outputFilename: string;
  sheetNames: string[];
  sourceFilename: string;
  sourceSheet: string;
  entityColumn: string;
  uniqueEntityCount: number;
  deletionRowCount: number;
  summary: { columns: string[]; rows: unknown[][] };
  deletionData: { columns: string[]; rows: unknown[][] };
  workbookBase64: string;
};

export function processDeletionSummary(file: DeletionSummaryInput): Promise<DeletionSummaryResult> {
  const scriptPath = path.resolve(process.cwd(), "scripts/process_deletion_summary.py");
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
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Deletion summary worker exited with code ${code}`));
        return;
      }
      try {
        const result = JSON.parse(stdout) as DeletionSummaryResult;
        if (!result.workbookBase64 || result.sheetNames.length !== 2) throw new Error("Deletion summary worker returned an incomplete result");
        resolve(result);
      } catch (error) {
        reject(new Error(`Could not parse deletion summary response: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
    worker.stdin.write(JSON.stringify({ file }));
    worker.stdin.end();
  });
}
