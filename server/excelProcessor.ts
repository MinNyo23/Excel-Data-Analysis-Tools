import { spawn } from "node:child_process";
import path from "node:path";

export type ExcelInputFile = {
  name: string;
  data: string;
};

export type ExcelProcessingResult = {
  outputFilename: string;
  sheetNames: string[];
  fileCount: number;
  errors: string[];
  summary: { columns: string[]; rows: unknown[][] };
  addition: { columns: string[]; rows: unknown[][] };
  deletion: { columns: string[]; rows: unknown[][] };
  additionCount: number;
  deletionCount: number;
  workbookBase64: string;
};

export function processExcelFiles(files: ExcelInputFile): Promise<ExcelProcessingResult>;
export function processExcelFiles(files: ExcelInputFile[]): Promise<ExcelProcessingResult>;
export function processExcelFiles(files: ExcelInputFile | ExcelInputFile[]) {
  const normalized = Array.isArray(files) ? files : [files];
  const scriptPath = path.resolve(process.cwd(), "scripts/process_excel.py");

  return new Promise<ExcelProcessingResult>((resolve, reject) => {
    const worker = spawn("python3", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";

    worker.stdout.setEncoding("utf8");
    worker.stderr.setEncoding("utf8");
    worker.stdout.on("data", chunk => {
      stdout += chunk;
    });
    worker.stderr.on("data", chunk => {
      stderr += chunk;
    });
    worker.on("error", error => reject(error));
    worker.on("close", code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Excel worker exited with code ${code}`));
        return;
      }
      try {
        const result = JSON.parse(stdout) as ExcelProcessingResult;
        if (!result.workbookBase64 || !result.outputFilename) {
          throw new Error("Excel worker returned an incomplete result");
        }
        resolve(result);
      } catch (error) {
        reject(new Error(`Could not parse Excel worker response: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    worker.stdin.write(JSON.stringify({ files: normalized }));
    worker.stdin.end();
  });
}
