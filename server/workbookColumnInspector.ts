import { spawn } from "node:child_process";
import path from "node:path";

export type WorkbookColumnInspection = { sheetName: string; columns: string[] };

export function inspectWorkbookColumns(file: { name: string; data: string }): Promise<WorkbookColumnInspection> {
  return new Promise((resolve, reject) => {
    const worker = spawn("python3", [path.resolve(process.cwd(), "scripts/inspect_workbook_columns.py")], { stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    let errors = "";
    worker.stdout.on("data", chunk => output += chunk);
    worker.stderr.on("data", chunk => errors += chunk);
    worker.on("close", code => {
      if (code) return reject(new Error(errors || "Column inspection worker failed."));
      try { resolve(JSON.parse(output)); } catch { reject(new Error("The file columns could not be read.")); }
    });
    worker.stdin.end(JSON.stringify({ file }));
  });
}
