import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pairedColumnMappingSchema } from "./routers";

const project = process.cwd();
const source = (relativePath: string) => readFileSync(path.join(project, relativePath), "utf8");

describe("paired matching workflow UX", () => {
  it("provides distinct accessible paired-file zones, accepted type tags, optional mapping, progress, reset, and multi-sheet export controls", () => {
    const panel = source("client/src/components/PairedFileUploadPanel.tsx");
    const home = source("client/src/pages/Home.tsx");
    expect(home).toContain('originalLabel="Original File"');
    expect(panel).toContain("2nd File");
    expect(panel).toContain(".XLSX");
    expect(panel).toContain(".CSV");
    expect(panel).toContain("formatFileSize");
    expect(panel).toContain("Selected · {formatFileSize(originalFile.size)} · {MAX_UPLOAD_FILE_SIZE_LABEL} max");
    expect(panel).toContain("isSupportedWorkbookFileName(file.name)");
    expect(panel).toContain("Only CSV and XLSX files are allowed.");
    expect(panel).toContain('role="alert"');
    expect(panel).toContain("Release to select this Original File");
    expect(panel).toContain("Release to select this 2nd File");
    expect(panel).toContain("OPTIONAL COLUMN CONFIRMATION");
    expect(panel).toContain("Phone");
    expect(panel).toContain("NRC");
    expect(panel).toContain("Corporate Name");
    expect(panel).toContain("Reset / Process New Files");
    expect(panel).toContain("Parsing records and preparing your multi-sheet workbook");
    expect(home).toContain("<PairedFileUploadPanel");
    expect(home).toContain("Download Excel output");
  });

  it("keeps mappings optional, bounded, and strict while inspecting only temporary upload data", () => {
    const router = source("server/routers.ts");
    const inspector = source("server/workbookColumnInspector.ts");
    expect(pairedColumnMappingSchema.parse({ originalPhone: "Phone", secondNrc: "NRC" })).toEqual({ originalPhone: "Phone", secondNrc: "NRC" });
    expect(() => pairedColumnMappingSchema.parse({ unexpected: "column" })).toThrow();
    expect(router).toContain("workbookColumns");
    expect(router).toContain("normalizeUploadedFiles([input.file])");
    expect(inspector).toContain("inspect_workbook_columns.py");
  });
});
