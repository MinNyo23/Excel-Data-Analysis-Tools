import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const sourceRoot = "/home/ubuntu/excel-master-file-tool/dist/public";
const outputPath = "/tmp/vercel_excel_master_full_frontend.json";
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(fullPath);
      continue;
    }
    const buffer = await readFile(fullPath);
    const file = relative(sourceRoot, fullPath).replaceAll("\\", "/");
    const textAsset = /\.(?:html|css|js|json|txt|svg)$/i.test(file);
    files.push({ file, data: textAsset ? buffer.toString("utf8") : buffer.toString("base64"), ...(textAsset ? {} : { encoding: "base64" }) });
  }
}

await collect(sourceRoot);
files.push({
  file: "vercel.json",
  data: JSON.stringify({ rewrites: [{ source: "/(.*)", destination: "/index.html" }] }),
});

await writeFile(outputPath, JSON.stringify({
  teamId: "team_qtpMKBqVgXQPTCVgUtbb1fz6",
  name: "excel-master-file-tool",
  target: "preview",
  files,
}));

console.log(`Prepared ${files.length} frontend files for Vercel.`);
