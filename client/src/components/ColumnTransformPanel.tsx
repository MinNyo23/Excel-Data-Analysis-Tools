import { FileSpreadsheet, FileUp, Loader2, RotateCcw, Type } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ProcessButtonContent, WorkflowProgress } from "@/components/WorkflowProgress";
import { getWorkbookSelectionError, MAX_UPLOAD_FILE_SIZE_LABEL } from "@shared/uploadLimits";
import { toast } from "sonner";
import "./PairedFileUploadPanel.css";

export type ColumnTransformOperation =
  | "none"
  | "clean_spaces"
  | "remove_duplicates"
  | "flag_duplicates"
  | "add_text_front"
  | "add_text_end"
  | "add_number_front"
  | "delete_text"
  | "change_case"
  | "standardize_date";

export type ColumnTransformCase = "Proper Case" | "UPPERCASE" | "lowercase";

export type ColumnTransformStep = {
  column: string;
  operation: ColumnTransformOperation;
  param: string;
  caseType: ColumnTransformCase;
};

export type ColumnTransformSettings = {
  option1: ColumnTransformStep;
  enableSecondOption: boolean;
  option2: ColumnTransformStep;
};

export const EMPTY_COLUMN_TRANSFORM_STEP: ColumnTransformStep = {
  column: "",
  operation: "none",
  param: "",
  caseType: "Proper Case",
};

export const EMPTY_COLUMN_TRANSFORM_SETTINGS: ColumnTransformSettings = {
  option1: { ...EMPTY_COLUMN_TRANSFORM_STEP },
  enableSecondOption: false,
  option2: { ...EMPTY_COLUMN_TRANSFORM_STEP },
};

const OPERATION_OPTIONS: Array<{ value: ColumnTransformOperation; label: string }> = [
  { value: "none", label: "None (skip)" },
  { value: "clean_spaces", label: "Clean spaces and line breaks" },
  { value: "remove_duplicates", label: "Remove duplicate rows" },
  { value: "flag_duplicates", label: "Highlight / flag duplicates" },
  { value: "add_text_front", label: "Add text in front (prefix)" },
  { value: "add_text_end", label: "Add text to end (suffix)" },
  { value: "add_number_front", label: "Add serial number in front" },
  { value: "delete_text", label: "Delete specific text or number" },
  { value: "change_case", label: "Change text case" },
  { value: "standardize_date", label: "Format as date (YYYY-MM-DD)" },
];

function needsParam(operation: ColumnTransformOperation) {
  return operation === "add_text_front" || operation === "add_text_end" || operation === "delete_text";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  file: File | null;
  columns: string[];
  settings: ColumnTransformSettings;
  isInspecting: boolean;
  isProcessing: boolean;
  processingMessage: string;
  onFile: (file: File) => void;
  onSettingsChange: (settings: ColumnTransformSettings) => void;
  onProcess: () => void;
  onReset: () => void;
};

export function ColumnTransformPanel({
  file,
  columns,
  settings,
  isInspecting,
  isProcessing,
  processingMessage,
  onFile,
  onSettingsChange,
  onProcess,
  onReset,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const updateStep = (key: "option1" | "option2", patch: Partial<ColumnTransformStep>) => {
    onSettingsChange({
      ...settings,
      [key]: { ...settings[key], ...patch },
    });
  };

  const selectFile = (next?: File) => {
    if (!next) return;
    const error = getWorkbookSelectionError(next);
    if (error) {
      setSelectionError(error);
      toast.error(error);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSelectionError(null);
    onFile(next);
  };

  const canProcess = Boolean(file && settings.option1.column && settings.option1.operation !== "none" && !isInspecting && !isProcessing)
    && (!settings.enableSecondOption || Boolean(settings.option2.column && settings.option2.operation !== "none"));

  const reset = () => {
    if (inputRef.current) inputRef.current.value = "";
    setSelectionError(null);
    onReset();
  };

  return (
    <div className="paired-upload-flow">
      <div className="paired-upload-intro">
        <span>SINGLE FILE TRANSFORM</span>
        <p>Upload one workbook, choose a column and operation, then optionally add a second transformation before you run the analysis.</p>
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.csv" hidden onChange={event => selectFile(event.target.files?.[0])} />
      <button
        type="button"
        className={`paired-file-zone${isDragging ? " is-dragging" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={event => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files?.[0]); }}
      >
        <span className="paired-step-number">01</span>
        <span className="paired-zone-icon"><FileUp size={18} /></span>
        <strong>{file ? file.name : "Choose a CSV or XLSX file"}</strong>
        <p>{file ? "File loaded. Choose a column and operation below." : "One workbook is processed in memory. Nothing is saved to this application."}</p>
        {file ? <span className="selected-file-size">{formatFileSize(file.size)}</span> : null}
        {selectionError ? <span className="file-selection-error">{selectionError}</span> : null}
        <div className="accepted-file-tags" aria-label="Accepted file types"><span>.XLSX</span><span>.CSV</span></div>
        <small>Up to {MAX_UPLOAD_FILE_SIZE_LABEL} per file</small>
      </button>

      <div className="column-mapping-panel column-transform-panel">
        <strong>Option 1 · Primary transformation</strong>
        <p>Select the first column and what should happen to its values.</p>
        <div className="column-transform-grid">
          <label className="mapping-select">
            <span><FileSpreadsheet size={14} /> Column 1</span>
            <select value={settings.option1.column} onChange={event => updateStep("option1", { column: event.target.value })} disabled={!file || columns.length === 0}>
              <option value="">Choose a column</option>
              {columns.map(column => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
          <label className="mapping-select">
            <span><Type size={14} /> Operation 1</span>
            <select value={settings.option1.operation} onChange={event => updateStep("option1", { operation: event.target.value as ColumnTransformOperation })} disabled={!file}>
              {OPERATION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {needsParam(settings.option1.operation) ? (
          <label className="mapping-select column-transform-field">
            <span>Input value 1</span>
            <Input value={settings.option1.param} maxLength={80} placeholder="Text or number to add or delete" onChange={event => updateStep("option1", { param: event.target.value })} />
          </label>
        ) : null}
        {settings.option1.operation === "change_case" ? (
          <label className="mapping-select column-transform-field">
            <span>Case type 1</span>
            <select value={settings.option1.caseType} onChange={event => updateStep("option1", { caseType: event.target.value as ColumnTransformCase })}>
              <option value="Proper Case">Proper Case</option>
              <option value="UPPERCASE">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
            </select>
          </label>
        ) : null}
      </div>

      <label className="file-comparison-checkbox column-transform-toggle">
        <Checkbox checked={settings.enableSecondOption} disabled={!file} onCheckedChange={checked => onSettingsChange({ ...settings, enableSecondOption: checked === true })} />
        <span>Enable 2nd option (secondary transformation)</span>
      </label>

      {settings.enableSecondOption ? (
        <div className="column-mapping-panel column-transform-panel">
          <strong>Option 2 · Secondary transformation</strong>
          <p>Apply a second change to the same file after Option 1.</p>
          <div className="column-transform-grid">
            <label className="mapping-select">
              <span><FileSpreadsheet size={14} /> Column 2</span>
              <select value={settings.option2.column} onChange={event => updateStep("option2", { column: event.target.value })} disabled={columns.length === 0}>
                <option value="">Choose a column</option>
                {columns.map(column => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>
            <label className="mapping-select">
              <span><Type size={14} /> Operation 2</span>
              <select value={settings.option2.operation} onChange={event => updateStep("option2", { operation: event.target.value as ColumnTransformOperation })}>
                {OPERATION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          {needsParam(settings.option2.operation) ? (
            <label className="mapping-select column-transform-field">
              <span>Input value 2</span>
              <Input value={settings.option2.param} maxLength={80} placeholder="Text or number for the 2nd option" onChange={event => updateStep("option2", { param: event.target.value })} />
            </label>
          ) : null}
          {settings.option2.operation === "change_case" ? (
            <label className="mapping-select column-transform-field">
              <span>Case type 2</span>
              <select value={settings.option2.caseType} onChange={event => updateStep("option2", { caseType: event.target.value as ColumnTransformCase })}>
                <option value="Proper Case">Proper Case</option>
                <option value="UPPERCASE">UPPERCASE</option>
                <option value="lowercase">lowercase</option>
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {isInspecting ? <p className="mapping-inspection"><Loader2 className="animate-spin" size={14} /> Reading column names…</p> : null}

      <div className="paired-process-actions">
        <div>Choose columns first. Download only after you review the preview.</div>
        <div>
          <Button type="button" variant="outline" onClick={reset} disabled={!file || isProcessing}><RotateCcw size={16} /> Clear</Button>
          <Button type="button" className="process-button" onClick={onProcess} disabled={!canProcess}>
            <ProcessButtonContent active={isProcessing} idle={<>Run analysis</>} />
          </Button>
        </div>
      </div>
      <WorkflowProgress active={isProcessing} className="paired-progress-state" hint={processingMessage} />
    </div>
  );
}
