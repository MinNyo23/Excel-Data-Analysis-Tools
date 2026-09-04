import { CheckCircle2, FileSpreadsheet, FileUp, GitCompare, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { getWorkbookSelectionError, MAX_UPLOAD_FILE_SIZE_LABEL } from "@shared/uploadLimits";
import "./PairedFileUploadPanel.css";

export type FileComparisonOperation = "exists_in_file2" | "find_duplicates" | "missing_in_file2";

export type FileComparisonSettings = {
  file1Column1: string;
  file2Column1: string;
  enableSecondCondition: boolean;
  file1Column2: string;
  file2Column2: string;
  operation: FileComparisonOperation;
};

export const EMPTY_FILE_COMPARISON_SETTINGS: FileComparisonSettings = {
  file1Column1: "",
  file2Column1: "",
  enableSecondCondition: false,
  file1Column2: "",
  file2Column2: "",
  operation: "exists_in_file2",
};

const OPERATION_OPTIONS: Array<{ value: FileComparisonOperation; label: string }> = [
  { value: "exists_in_file2", label: "Check if File 1 data exists in File 2" },
  { value: "find_duplicates", label: "Find exact duplicates across both files" },
  { value: "missing_in_file2", label: "Find missing records (in File 1 but not File 2)" },
];

type Props = {
  file1: File | null;
  file2: File | null;
  file1Columns: string[];
  file2Columns: string[];
  settings: FileComparisonSettings;
  isInspecting: boolean;
  isProcessing: boolean;
  processingMessage: string;
  onFile1: (file: File) => void;
  onFile2: (file: File) => void;
  onSettingsChange: <K extends keyof FileComparisonSettings>(field: K, value: FileComparisonSettings[K]) => void;
  onProcess: () => void;
  onReset: () => void;
};

function AcceptedFileTags() {
  return <div className="accepted-file-tags" aria-label="Accepted file types"><span>.XLSX</span><span>.CSV</span></div>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ColumnSelect({ label, value, columns, onChange, disabled }: { label: string; value: string; columns: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="mapping-select">
      <span><FileSpreadsheet size={14} />{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} disabled={disabled || columns.length === 0}>
        <option value="">Choose a column</option>
        {columns.map(column => <option key={column} value={column}>{column}</option>)}
      </select>
    </label>
  );
}

export function ConditionalFileComparisonPanel({
  file1,
  file2,
  file1Columns,
  file2Columns,
  settings,
  isInspecting,
  isProcessing,
  processingMessage,
  onFile1,
  onFile2,
  onSettingsChange,
  onProcess,
  onReset,
}: Props) {
  const file1InputRef = useRef<HTMLInputElement>(null);
  const file2InputRef = useRef<HTMLInputElement>(null);
  const [dragTarget, setDragTarget] = useState<"file1" | "file2" | null>(null);
  const [selectionError, setSelectionError] = useState<{ target: "file1" | "file2"; message: string } | null>(null);

  const bothFilesReady = Boolean(file1 && file2);
  const primaryColumnsReady = Boolean(settings.file1Column1 && settings.file2Column1);
  const secondaryColumnsReady = !settings.enableSecondCondition || Boolean(settings.file1Column2 && settings.file2Column2);
  const canProcess = bothFilesReady && primaryColumnsReady && secondaryColumnsReady && !isInspecting && !isProcessing;

  const selectFile = (target: "file1" | "file2", file?: File) => {
    if (!file) return;
    const error = getWorkbookSelectionError(file);
    if (error) {
      setSelectionError({ target, message: error });
      if (target === "file1" && file1InputRef.current) file1InputRef.current.value = "";
      if (target === "file2" && file2InputRef.current) file2InputRef.current.value = "";
      return;
    }
    setSelectionError(current => current?.target === target ? null : current);
    target === "file1" ? onFile1(file) : onFile2(file);
  };

  const dropHandlers = (target: "file1" | "file2") => ({
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); setDragTarget(target); },
    onDragLeave: () => setDragTarget(null),
    onDrop: (event: React.DragEvent) => { event.preventDefault(); setDragTarget(null); selectFile(target, event.dataTransfer.files?.[0]); },
  });

  const reset = () => {
    if (file1InputRef.current) file1InputRef.current.value = "";
    if (file2InputRef.current) file2InputRef.current.value = "";
    setSelectionError(null);
    onReset();
  };

  return (
    <div className="paired-upload-flow">
      <div className="paired-upload-intro">
        <span>STEP 1 · ADD BOTH FILES</span>
        <p>Upload File 1 and File 2, choose one or two matching column pairs, then run the comparison in memory.</p>
      </div>
      <div className="paired-dropzone-grid">
        <section className={`paired-file-zone ${dragTarget === "file1" ? "is-dragging" : ""}`} {...dropHandlers("file1")} role="button" tabIndex={0} onClick={() => file1InputRef.current?.click()} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") file1InputRef.current?.click(); }} aria-label="Choose File 1">
          <input ref={file1InputRef} type="file" accept=".xlsx,.csv" hidden onChange={event => selectFile("file1", event.target.files?.[0])} />
          <span className="paired-step-number">01</span><span className="paired-zone-icon"><FileSpreadsheet size={21} /></span><strong>File 1</strong><p>{file1 ? file1.name : "Primary workbook to analyze"}</p>{file1 && <span className="selected-file-size"><CheckCircle2 size={13} /> Selected · {formatFileSize(file1.size)} · {MAX_UPLOAD_FILE_SIZE_LABEL} max</span>}<AcceptedFileTags /><small aria-live="polite">{dragTarget === "file1" ? "Release to select File 1" : file1 ? "Selected · choose again to replace" : "Drop File 1 here or browse"}</small>{selectionError?.target === "file1" && <span className="file-selection-error" role="alert">{selectionError.message}</span>}
        </section>
        <section className={`paired-file-zone ${dragTarget === "file2" ? "is-dragging" : ""}`} {...dropHandlers("file2")} role="button" tabIndex={0} onClick={() => file2InputRef.current?.click()} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") file2InputRef.current?.click(); }} aria-label="Choose File 2">
          <input ref={file2InputRef} type="file" accept=".xlsx,.csv" hidden onChange={event => selectFile("file2", event.target.files?.[0])} />
          <span className="paired-step-number">02</span><span className="paired-zone-icon"><FileUp size={21} /></span><strong>File 2</strong><p>{file2 ? file2.name : "Reference workbook to compare against"}</p>{file2 && <span className="selected-file-size"><CheckCircle2 size={13} /> Selected · {formatFileSize(file2.size)} · {MAX_UPLOAD_FILE_SIZE_LABEL} max</span>}<AcceptedFileTags /><small aria-live="polite">{dragTarget === "file2" ? "Release to select File 2" : file2 ? "Selected · choose again to replace" : "Drop File 2 here or browse"}</small>{selectionError?.target === "file2" && <span className="file-selection-error" role="alert">{selectionError.message}</span>}
        </section>
      </div>

      <details className="column-mapping-panel" open={bothFilesReady}>
        <summary><span><GitCompare size={17} /> STEP 2 · COMPARISON CONDITIONS</span><small>Select the columns and operation before running the analysis.</small></summary>
        <p>Condition 1 compares one column from each file. Enable a second condition to require both column pairs to match together.</p>
        <div className="column-mapping-grid">
          <div>
            <strong>Condition 1</strong>
            <ColumnSelect label="File 1 Column 1" value={settings.file1Column1} columns={file1Columns} onChange={value => onSettingsChange("file1Column1", value)} disabled={!bothFilesReady} />
            <ColumnSelect label="File 2 Column 1" value={settings.file2Column1} columns={file2Columns} onChange={value => onSettingsChange("file2Column1", value)} disabled={!bothFilesReady} />
          </div>
          <div>
            <strong>Operation</strong>
            <label className="mapping-select">
              <span><GitCompare size={14} />Comparison mode</span>
              <select value={settings.operation} onChange={event => onSettingsChange("operation", event.target.value as FileComparisonOperation)} disabled={!bothFilesReady}>
                {OPERATION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="mapping-select file-comparison-checkbox">
              <span><Checkbox checked={settings.enableSecondCondition} disabled={!bothFilesReady} onCheckedChange={checked => onSettingsChange("enableSecondCondition", checked === true)} />Enable 2nd condition</span>
            </label>
          </div>
        </div>
        {settings.enableSecondCondition && (
          <div className="column-mapping-grid file-comparison-second-condition">
            <div>
              <strong>Condition 2</strong>
              <ColumnSelect label="File 1 Column 2" value={settings.file1Column2} columns={file1Columns} onChange={value => onSettingsChange("file1Column2", value)} disabled={!bothFilesReady} />
            </div>
            <div>
              <strong>File 2 Column 2</strong>
              <ColumnSelect label="File 2 Column 2" value={settings.file2Column2} columns={file2Columns} onChange={value => onSettingsChange("file2Column2", value)} disabled={!bothFilesReady} />
            </div>
          </div>
        )}
        {isInspecting && <div className="mapping-inspection" role="status"><Loader2 className="animate-spin" size={15} /><span>Reading column names securely in memory…</span></div>}
      </details>

      <div className="paired-process-actions">
        <div><ShieldCheck size={15} /><span>Secure in-memory comparison · Excel summary and result sheets</span></div>
        <div>
          <Button variant="outline" onClick={reset} disabled={isProcessing || (!file1 && !file2)}><RotateCcw size={16} /> Reset / Process New Files</Button>
          <Button className="process-button" onClick={onProcess} disabled={!canProcess}>{isProcessing ? <><Loader2 className="animate-spin" size={17} />{processingMessage}</> : <><GitCompare size={17} /> Run analysis</>}</Button>
        </div>
      </div>
      {isProcessing && <div className="paired-progress-state" role="status" aria-live="polite"><Progress value={68} /><span>{processingMessage} Building composite keys and preparing your comparison workbook…</span></div>}
    </div>
  );
}
