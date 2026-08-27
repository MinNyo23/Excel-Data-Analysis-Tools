import { spawn } from "node:child_process";
import path from "node:path";

export type DeletionDuplicatesInput = { name: string; data: string };
export type DeletionDuplicatesResult = {
  outputFilename: string;
  sheetNames: string[];
  sourceFilename: string;
  sourceSheet: string;
  nameColumn: string;
  nrcColumn: string;
  originalCount: number;
  cleanCount: number;
  duplicateCount: number;
  cleanData: { columns: string[]; rows: unknown[][] };
  duplicates: { columns: string[]; rows: unknown[][] };
  workbookBase64: string;
};

export function processDeletionDuplicates(file: DeletionDuplicatesInput): Promise<DeletionDuplicatesResult> {
  const scriptPath = path.resolve(process.cwd(), "scripts/process_deletion_duplicates.py");
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
      if (code !== 0) { reject(new Error(stderr.trim() || `Duplicate worker exited with code ${code}`)); return; }
      try {
        const result = JSON.parse(stdout) as DeletionDuplicatesResult;
        if (!result.workbookBase64 || result.sheetNames.length !== 2) throw new Error("Duplicate worker returned an incomplete result");
        resolve(result);
      } catch (error) {
        reject(new Error(`Could not parse duplicate response: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
    worker.stdin.write(JSON.stringify({ file }));
    worker.stdin.end();
  });
}
