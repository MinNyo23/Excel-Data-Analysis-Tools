import { Building2, CheckCircle2, FileSpreadsheet, FileUp, Loader2, Phone, RotateCcw, ShieldCheck } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import "./PairedFileUploadPanel.css";

export type PairMapping = {
  originalPhone: string;
  originalNrc: string;
  originalCorporateName: string;
  secondPhone: string;
  secondNrc: string;
};

type Field = keyof PairMapping;

type Props = {
  originalFile: File | null;
  secondFile: File | null;
  originalLabel: string;
  originalDescription: string;
  secondLabel: string;
  secondDescription: string;
  originalColumns: string[];
  secondColumns: string[];
  mapping: PairMapping;
  showPhoneMapping?: boolean;
  isInspecting: boolean;
  isProcessing: boolean;
  processingMessage: string;
  onOriginalFile: (file: File) => void;
  onSecondFile: (file: File) => void;
  onMappingChange: (field: Field, value: string) => void;
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

function MappingSelect({ label, icon, value, columns, onChange }: { label: string; icon: ReactNode; value: string; columns: string[]; onChange: (value: string) => void }) {
  return <label className="mapping-select"><span>{icon}{label}</span><select value={value} onChange={event => onChange(event.target.value)} disabled={columns.length === 0}><option value="">Automatic detection</option>{columns.map(column => <option key={column} value={column}>{column}</option>)}</select></label>;
}

export function PairedFileUploadPanel({ originalFile, secondFile, originalLabel, originalDescription, secondLabel, secondDescription, originalColumns, secondColumns, mapping, showPhoneMapping = true, isInspecting, isProcessing, processingMessage, onOriginalFile, onSecondFile, onMappingChange, onProcess, onReset }: Props) {
  const originalInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);
  const [dragTarget, setDragTarget] = useState<"original" | "second" | null>(null);
  const selectFile = (target: "original" | "second", file?: File) => { if (!file) return; target === "original" ? onOriginalFile(file) : onSecondFile(file); };
  const dropHandlers = (target: "original" | "second") => ({
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); setDragTarget(target); },
    onDragLeave: () => setDragTarget(null),
    onDrop: (event: React.DragEvent) => { event.preventDefault(); setDragTarget(null); selectFile(target, event.dataTransfer.files?.[0]); },
  });
  const reset = () => { if (originalInputRef.current) originalInputRef.current.value = ""; if (secondInputRef.current) secondInputRef.current.value = ""; onReset(); };

  return <div className="paired-upload-flow">
    <div className="paired-upload-intro"><span>STEP 1 · ADD BOTH FILES</span><p>Choose the original source first, then the second file to compare. Files remain temporary and are never saved.</p></div>
    <div className="paired-dropzone-grid">
      <section className={`paired-file-zone ${dragTarget === "original" ? "is-dragging" : ""}`} {...dropHandlers("original")} role="button" tabIndex={0} onClick={() => originalInputRef.current?.click()} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") originalInputRef.current?.click(); }} aria-label={`Choose ${originalLabel}`}>
        <input ref={originalInputRef} type="file" accept=".xlsx,.csv" hidden onChange={event => selectFile("original", event.target.files?.[0])} />
        <span className="paired-step-number">01</span><span className="paired-zone-icon"><FileSpreadsheet size={21} /></span><strong>{originalLabel}</strong><p>{originalFile ? originalFile.name : originalDescription}</p>{originalFile && <span className="selected-file-size"><CheckCircle2 size={13}/> Selected · {formatFileSize(originalFile.size)}</span>}<AcceptedFileTags /><small aria-live="polite">{dragTarget === "original" ? "Release to select this Original File" : originalFile ? "Selected · choose again to replace" : "Drop Original File here or browse"}</small>
      </section>
      <section className={`paired-file-zone ${dragTarget === "second" ? "is-dragging" : ""}`} {...dropHandlers("second")} role="button" tabIndex={0} onClick={() => secondInputRef.current?.click()} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") secondInputRef.current?.click(); }} aria-label={`Choose ${secondLabel}`}>
        <input ref={secondInputRef} type="file" accept=".xlsx,.csv" hidden onChange={event => selectFile("second", event.target.files?.[0])} />
        <span className="paired-step-number">02</span><span className="paired-zone-icon"><FileUp size={21} /></span><strong>{secondLabel}</strong><p>{secondFile ? secondFile.name : secondDescription}</p>{secondFile && <span className="selected-file-size"><CheckCircle2 size={13}/> Selected · {formatFileSize(secondFile.size)}</span>}<AcceptedFileTags /><small aria-live="polite">{dragTarget === "second" ? "Release to select this 2nd File" : secondFile ? "Selected · choose again to replace" : "Drop 2nd File here or browse"}</small>
      </section>
    </div>
    <details className="column-mapping-panel" open>
      <summary><span><CheckCircle2 size={17} /> STEP 2 · OPTIONAL COLUMN CONFIRMATION</span><small>Automatic detection is used unless you choose a column.</small></summary>
      <p>Confirm the fields to use before processing. These temporary choices apply only to this run and are not saved.</p>
      <div className="column-mapping-grid">
        <div><strong>Original File</strong>{showPhoneMapping && <MappingSelect label="Phone" icon={<Phone size={14}/>} value={mapping.originalPhone} columns={originalColumns} onChange={value => onMappingChange("originalPhone", value)} />}<MappingSelect label="NRC" icon={<FileSpreadsheet size={14}/>} value={mapping.originalNrc} columns={originalColumns} onChange={value => onMappingChange("originalNrc", value)} /><MappingSelect label="Corporate Name" icon={<Building2 size={14}/>} value={mapping.originalCorporateName} columns={originalColumns} onChange={value => onMappingChange("originalCorporateName", value)} /></div>
        <div><strong>2nd File</strong>{showPhoneMapping && <MappingSelect label="Phone" icon={<Phone size={14}/>} value={mapping.secondPhone} columns={secondColumns} onChange={value => onMappingChange("secondPhone", value)} />}<MappingSelect label="NRC" icon={<FileSpreadsheet size={14}/>} value={mapping.secondNrc} columns={secondColumns} onChange={value => onMappingChange("secondNrc", value)} /></div>
      </div>
      {isInspecting && <div className="mapping-inspection" role="status"><Loader2 className="animate-spin" size={15}/><span>Reading column names securely in memory…</span></div>}
    </details>
    <div className="paired-process-actions"><div><ShieldCheck size={15}/><span>Secure in-memory comparison · multi-sheet Excel output</span></div><div><Button variant="outline" onClick={reset} disabled={isProcessing || (!originalFile && !secondFile)}><RotateCcw size={16}/> Reset / Process New Files</Button><Button className="process-button" onClick={onProcess} disabled={!originalFile || !secondFile || isInspecting || isProcessing}>{isProcessing ? <><Loader2 className="animate-spin" size={17}/>{processingMessage}</> : <><FileSpreadsheet size={17}/> Parse and preview</>}</Button></div></div>
    {isProcessing && <div className="paired-progress-state" role="status" aria-live="polite"><Progress value={68}/><span>{processingMessage} Parsing records and preparing your multi-sheet workbook…</span></div>}
  </div>;
}
