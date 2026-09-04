import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getFriendlyApiMessage } from "@/lib/apiFeedback";
import "@/privacy-diagram.css";
import { WorkflowGuide, type WorkflowGuideContent } from "@/components/WorkflowGuide";
import { ConditionalFileComparisonPanel, EMPTY_FILE_COMPARISON_SETTINGS, type FileComparisonSettings } from "@/components/ConditionalFileComparisonPanel";
import { PairedFileUploadPanel, type PairMapping } from "@/components/PairedFileUploadPanel";
import { BriefcaseBusiness, Building2, Download, FileSpreadsheet, FileUp, GitCompare, Layers3, Loader2, ListTree, Phone, RotateCcw, ShieldCheck, Trash2, UserRound, X } from "lucide-react";

const ACCEPTED_TYPES = ".xlsx,.csv";
// Vercel Functions cap request bodies at 4.5 MB. Base64 expands files by
// roughly one third, so keep the raw consolidation payload below that ceiling.
const MAX_CONSOLIDATION_BYTES = 3 * 1024 * 1024;
const TOOL_CARDS = [
  { slug: "consolidation", title: "Master consolidation", description: "Merge Addition and Deletion sheets from many workbooks.", icon: Layers3 },
  { slug: "deletion-summary", title: "Deletion summary list", description: "Count deletion records by entity and preserve the source data.", icon: ListTree },
  { slug: "duplicates", title: "Duplicate separation", description: "Keep first records and move repeated name and NRC combinations.", icon: Layers3 },
  { slug: "entity-summary", title: "Deletion with summary", description: "Compare entity counts across every sheet in one workbook.", icon: ListTree },
  { slug: "addition-exit", title: "Addition & exit match", description: "Validate exit data against an original Addition list.", icon: Layers3 },
  { slug: "file-comparison", title: "Multi-condition file compare", description: "Compare two workbooks with one or two column conditions.", icon: GitCompare },
  { slug: "onboard", title: "Deletion & onboard check", description: "Match deletion NRCs against onboard records.", icon: ListTree },
  { slug: "ready-upload", title: "Ready file to upload", description: "Convert employee files into the final upload schema.", icon: FileSpreadsheet },
  { slug: "facility", title: "Facility by facility", description: "Create an entity summary and separate worksheets per facility.", icon: Layers3 },
];

const WORKFLOW_GUIDES: Record<string, WorkflowGuideContent> = {
  consolidation: {
    title: "Master consolidation",
    purpose: "Combine Addition and Deletion data from your corporate workbooks into one master Excel file.",
    upload: "Choose one or more CSV or XLSX corporate workbooks. For the full report, use files that contain Addition and/or Deletion sheets.",
    process: "The tool finds matching Addition and Deletion sheets, combines the records, adds the source filename, and prepares a summary report.",
    output: "Review the Summary Report, Addition, and Deletion previews, then download one consolidated XLSX workbook.",
  },
  "deletion-summary": {
    title: "Deletion summary list",
    purpose: "Turn one deletion workbook into a simple entity-by-entity summary while keeping the source deletion data available.",
    upload: "Choose one CSV or XLSX deletion file with an Entity Name column.",
    process: "The tool counts deletion records for every entity and keeps the original deletion rows for your review.",
    output: "Review the entity totals and source data, then download a workbook with Deletion Entity Summary and Deletion Data sheets.",
  },
  duplicates: {
    title: "Duplicate separation",
    purpose: "Find repeated deletion records and separate the repeated rows into their own list.",
    upload: "Choose one CSV or XLSX deletion file with Employee Full Name and NRC No columns.",
    process: "The first record for each matching name-and-NRC combination stays in Clean Data; later matching records move to Duplicates Moved.",
    output: "Review both groups, then download one workbook with Clean Data and Duplicates Moved sheets.",
  },
  "entity-summary": {
    title: "Deletion with summary",
    purpose: "Compare Entity Name totals across all sheets in one workbook without removing the source sheets.",
    upload: "Choose one multi-sheet CSV or XLSX workbook. Each sheet you want to compare should include an Entity Name column.",
    process: "The tool counts each entity on every source sheet and creates one combined Entity Summary sheet.",
    output: "Review the totals across sheets, then download the workbook with the new Entity Summary and your original sheets.",
  },
  "addition-exit": {
    title: "Addition and exit match",
    purpose: "Check Exit Data against your original Addition records so you can see which people match.",
    upload: "Choose two CSV or XLSX files: your original Addition file and the Exit Data file you want to validate.",
    process: "The tool checks mobile numbers first, then NRC numbers, and separates records into match groups for review.",
    output: "Review the Both Matched, Mobile Only, NRC Only, and No Match groups, then download the match report.",
  },
  "file-comparison": {
    title: "Multi-condition file compare",
    purpose: "Compare two Excel files with one or two column conditions, similar to a Colab-style file-to-file analysis.",
    upload: "Choose two CSV or XLSX files. After upload, pick the columns to compare from each file.",
    process: "The tool builds a composite match key from your selected columns, then runs the comparison operation you choose.",
    output: "Review the summary and result preview, then download the comparison workbook.",
  },
  onboard: {
    title: "Deletion check with onboard",
    purpose: "Check a deletion list against onboard records and clearly separate matched and unmatched NRC numbers.",
    upload: "Choose two CSV or XLSX files: the original onboard file and the deletion file you want to check.",
    process: "The tool matches NRC numbers, adds available onboard details to matched records, and keeps unmatched records separate.",
    output: "Review the Summary, Matched List, and No Match List, then download the completed NRC check report.",
  },
  "ready-upload": {
    title: "Ready file to upload",
    purpose: "Convert employee data into a clean, upload-ready workbook with the required field names and date format.",
    upload: "Choose one CSV or XLSX employee source file with the information you want to prepare for upload.",
    process: "The tool renames mapped columns, normalizes dates, adds required blank fields, and arranges the final upload columns.",
    output: "Review the converted preview and final column count, then download the ready-to-upload XLSX file.",
  },
  facility: {
    title: "Addition convert facility by facility",
    purpose: "Split Addition records into separate worksheets for every facility or Entity Name and create an overall summary.",
    upload: "Choose one CSV or XLSX Addition file with an Entity Name column.",
    process: "The tool counts records for each entity, keeps all data together, and creates a clean worksheet for every facility.",
    output: "Review the facility totals, then download a workbook with Summary, All Data, and one sheet for each facility.",
  },
};

type SelectedFile = { id: string; file: File };
type Preview = { columns: string[]; rows: unknown[][] };
type EditableProfile = { displayName: string; phoneNumber: string; organization: string; jobTitle: string };
type Result = {
  outputFilename: string;
  fileCount: number;
  errors: string[];
  summary: Preview;
  addition: Preview;
  deletion: Preview;
  additionCount: number;
  deletionCount: number;
  workbookBase64: string;
};
type DeletionDuplicatesResult = {
  outputFilename: string;
  sourceFilename: string;
  sourceSheet: string;
  nameColumn: string;
  nrcColumn: string;
  originalCount: number;
  cleanCount: number;
  duplicateCount: number;
  cleanData: Preview;
  duplicates: Preview;
  workbookBase64: string;
};
type DeletionWithSummaryResult = { outputFilename: string; sourceSheetCount: number; entityCount: number; summary: Preview; workbookBase64: string };
type AdditionExitMatchResult = { outputFilename: string; summary: Preview; groups: Record<string, Preview>; workbookBase64: string };
type DeletionOnboardMatchResult = { outputFilename: string; summary: Preview; matched: Preview; noMatch: Preview; workbookBase64: string };
type ReadyUploadResult = { outputFilename: string; rowCount: number; columnCount: number; preview: Preview; workbookBase64: string };
type FacilityConversionResult = { outputFilename: string; facilityCount: number; recordCount: number; summary: Preview; facilitySheets: string[]; workbookBase64: string };
type FileComparisonResult = { outputFilename: string; operationLabel: string; file1RowCount: number; resultRowCount: number; summary: Preview; result: Preview; workbookBase64: string };
type DeletionSummaryResult = {
  outputFilename: string;
  sourceFilename: string;
  sourceSheet: string;
  entityColumn: string;
  uniqueEntityCount: number;
  deletionRowCount: number;
  summary: Preview;
  deletionData: Preview;
  workbookBase64: string;
};
const EMPTY_PAIR_MAPPING: PairMapping = { originalPhone: "", originalNrc: "", originalCorporateName: "", secondPhone: "", secondNrc: "" };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function PreviewTable({ preview }: { preview?: Preview }) {
  if (!preview || preview.columns.length === 0) {
    return <div className="empty-preview">No rows were found for this sheet.</div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{preview.columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{preview.rows.map((row, index) => <tr key={index}>{row.map((value, cellIndex) => <td key={cellIndex}>{value === null || value === undefined ? "—" : String(value)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function downloadBytes(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadResult(result: Result) {
  downloadBytes(result.workbookBase64, result.outputFilename);
}

function totalFromPreview(preview: Preview) {
  const totalRow = preview.rows.find(row => String(row[0] ?? "").toLowerCase().includes("total"));
  return Number(totalRow?.[1] ?? 0) || 0;
}

function storedFileNames(value: string) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String).join(", ") : ""; } catch { return ""; }
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const activeTool = location.startsWith("/tools/") ? location.split("/").pop() : "home";
  const activeWorkflowGuide = activeTool ? WORKFLOW_GUIDES[activeTool] : undefined;
  const { isAuthenticated } = useAuth();
  const historyUtils = trpc.useUtils();
  const profileQuery = trpc.profile.me.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const historyQuery = trpc.processHistory.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const historyMutation = trpc.processHistory.record.useMutation({ onSuccess: () => historyUtils.processHistory.list.invalidate() });
  const clearHistoryMutation = trpc.processHistory.clear.useMutation({ onSuccess: data => { historyUtils.processHistory.list.invalidate(); toast.success(`${data.deletedCount} process record${data.deletedCount === 1 ? "" : "s"} deleted.`); }, onError: error => toast.error(getFriendlyApiMessage(error, "Process history could not be cleared. Please try again.")) });
  const [profileForm, setProfileForm] = useState<EditableProfile>({ displayName: "", phoneNumber: "", organization: "", jobTitle: "" });
  useEffect(() => {
    if (profileQuery.data) setProfileForm(profileQuery.data.profile ?? { displayName: "", phoneNumber: "", organization: "", jobTitle: "" });
  }, [profileQuery.data]);
  const profileMutation = trpc.profile.update.useMutation({
    onSuccess: () => { historyUtils.profile.me.invalidate(); toast.success("Your profile has been saved securely."); },
    onError: error => toast.error(getFriendlyApiMessage(error, "Your profile could not be saved. Please try again.")),
  });
  const toolTotals = useMemo(() => Object.entries((historyQuery.data ?? []).reduce<Record<string, { label: string; count: number }>>((totals, item) => {
    totals[item.toolKey] = totals[item.toolKey] ?? { label: item.toolName, count: 0 };
    totals[item.toolKey].count += 1;
    return totals;
  }, {})), [historyQuery.data]);
  const inputRef = useRef<HTMLInputElement>(null);
  const deletionInputRef = useRef<HTMLInputElement>(null);
  const duplicateInputRef = useRef<HTMLInputElement>(null);
  const entitySummaryInputRef = useRef<HTMLInputElement>(null);
  const readyUploadInputRef = useRef<HTMLInputElement>(null);
  const facilityInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [deletionSummary, setDeletionSummary] = useState<DeletionSummaryResult | null>(null);
  const [deletionFile, setDeletionFile] = useState<File | null>(null);
  const [duplicateFile, setDuplicateFile] = useState<File | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<DeletionDuplicatesResult | null>(null);
  const [entitySummaryFile, setEntitySummaryFile] = useState<File | null>(null);
  const [entitySummaryResult, setEntitySummaryResult] = useState<DeletionWithSummaryResult | null>(null);
  const [originalMatchFile, setOriginalMatchFile] = useState<File | null>(null);
  const [exitMatchFile, setExitMatchFile] = useState<File | null>(null);
  const [matchResult, setMatchResult] = useState<AdditionExitMatchResult | null>(null);
  const [additionExitOriginalColumns, setAdditionExitOriginalColumns] = useState<string[]>([]);
  const [additionExitSecondColumns, setAdditionExitSecondColumns] = useState<string[]>([]);
  const [additionExitMapping, setAdditionExitMapping] = useState<PairMapping>(EMPTY_PAIR_MAPPING);
  const [onboardFile, setOnboardFile] = useState<File | null>(null);
  const [deletionCheckFile, setDeletionCheckFile] = useState<File | null>(null);
  const [onboardResult, setOnboardResult] = useState<DeletionOnboardMatchResult | null>(null);
  const [onboardOriginalColumns, setOnboardOriginalColumns] = useState<string[]>([]);
  const [onboardSecondColumns, setOnboardSecondColumns] = useState<string[]>([]);
  const [onboardMapping, setOnboardMapping] = useState<PairMapping>(EMPTY_PAIR_MAPPING);
  const [readyUploadFile, setReadyUploadFile] = useState<File | null>(null);
  const [readyUploadResult, setReadyUploadResult] = useState<ReadyUploadResult | null>(null);
  const [facilityFile, setFacilityFile] = useState<File | null>(null);
  const [facilityResult, setFacilityResult] = useState<FacilityConversionResult | null>(null);
  const [comparisonFile1, setComparisonFile1] = useState<File | null>(null);
  const [comparisonFile2, setComparisonFile2] = useState<File | null>(null);
  const [comparisonResult, setComparisonResult] = useState<FileComparisonResult | null>(null);
  const [comparisonFile1Columns, setComparisonFile1Columns] = useState<string[]>([]);
  const [comparisonFile2Columns, setComparisonFile2Columns] = useState<string[]>([]);
  const [comparisonSettings, setComparisonSettings] = useState<FileComparisonSettings>(EMPTY_FILE_COMPARISON_SETTINGS);
  function recordCompletion(toolKey: string, toolName: string, inputFileNames: string[], outputFilename: string, totalRecords: number) {
    if (!isAuthenticated || inputFileNames.length === 0) return;
    historyMutation.mutate({ toolKey, toolName, inputFileNames, outputFilename, totalRecords });
  }
  const facilityMutation = trpc.facilityConversion.process.useMutation({ onSuccess: data => { const item = data as FacilityConversionResult; setFacilityResult(item); recordCompletion("facility", "Facility by facility", facilityFile ? [facilityFile.name] : [], item.outputFilename, item.recordCount); toast.success("Facility workbook is ready."); }, onError: error => toast.error(getFriendlyApiMessage(error, "The facility workbook could not be created. Please try again.")) });
  const readyUploadMutation = trpc.readyUpload.process.useMutation({ onSuccess: data => { const item = data as ReadyUploadResult; setReadyUploadResult(item); recordCompletion("ready-upload", "Ready file to upload", readyUploadFile ? [readyUploadFile.name] : [], item.outputFilename, item.rowCount); toast.success("Upload-ready workbook is ready."); }, onError: error => toast.error(getFriendlyApiMessage(error, "The file could not be converted. Please try again.")) });
  const onboardMutation = trpc.deletionOnboardMatch.process.useMutation({ onSuccess: data => { const item = data as DeletionOnboardMatchResult; setOnboardResult(item); recordCompletion("onboard", "Deletion & onboard check", [onboardFile?.name, deletionCheckFile?.name].filter((name): name is string => Boolean(name)), item.outputFilename, totalFromPreview(item.summary)); toast.success("NRC match report is ready."); }, onError: error => toast.error(getFriendlyApiMessage(error, "NRC matching could not be completed. Please try again.")) });
  const matchMutation = trpc.additionExitMatch.process.useMutation({ onSuccess: data => { const item = data as AdditionExitMatchResult; setMatchResult(item); recordCompletion("addition-exit", "Addition & exit match", [originalMatchFile?.name, exitMatchFile?.name].filter((name): name is string => Boolean(name)), item.outputFilename, totalFromPreview(item.summary)); toast.success("Addition match report is ready."); }, onError: error => toast.error(getFriendlyApiMessage(error, "The match report could not be created. Please try again.")) });
  const fileComparisonMutation = trpc.fileComparison.process.useMutation({ onSuccess: data => { const item = data as FileComparisonResult; setComparisonResult(item); recordCompletion("file-comparison", "Multi-condition file compare", [comparisonFile1?.name, comparisonFile2?.name].filter((name): name is string => Boolean(name)), item.outputFilename, item.resultRowCount); toast.success("File comparison report is ready."); }, onError: error => toast.error(getFriendlyApiMessage(error, "The file comparison could not be completed. Please try again.")) });
  const entitySummaryMutation = trpc.deletionWithSummary.process.useMutation({
    onSuccess: data => { const item = data as DeletionWithSummaryResult; setEntitySummaryResult(item); recordCompletion("entity-summary", "Deletion with summary", entitySummaryFile ? [entitySummaryFile.name] : [], item.outputFilename, item.entityCount); toast.success("Entity summary is ready to review."); },
    onError: error => toast.error(getFriendlyApiMessage(error, "The entity summary could not be created. Please try again.")),
  });
  const duplicateMutation = trpc.deletionDuplicates.process.useMutation({
    onSuccess: data => { const item = data as DeletionDuplicatesResult; setDuplicateResult(item); recordCompletion("duplicates", "Duplicate separation", duplicateFile ? [duplicateFile.name] : [], item.outputFilename, item.originalCount); toast.success("Duplicate rows have been separated."); },
    onError: error => toast.error(getFriendlyApiMessage(error, "The duplicate separation could not be completed. Please try again.")),
  });
  const deletionMutation = trpc.deletionSummary.process.useMutation({
    onSuccess: data => { const item = data as DeletionSummaryResult; setDeletionSummary(item); recordCompletion("deletion-summary", "Deletion summary list", deletionFile ? [deletionFile.name] : [], item.outputFilename, item.deletionRowCount); toast.success("Deletion summary list is ready to review."); },
    onError: error => toast.error(getFriendlyApiMessage(error, "The deletion summary could not be created. Please try again.")),
  });
  const processMutation = trpc.excel.process.useMutation({
    onSuccess: data => {
      const item = data as Result;
      setResult(item);
      recordCompletion("consolidation", "Master consolidation", selectedFiles.map(item => item.file.name), item.outputFilename, item.additionCount + item.deletionCount);
      toast.success("Master workbook is ready to review.");
    },
    onError: error => toast.error(getFriendlyApiMessage(error, "The files could not be processed. Please check the selected workbook and try again.")),
  });
  const workbookColumnsMutation = trpc.workbookColumns.inspect.useMutation();

  const totalSize = useMemo(() => selectedFiles.reduce((sum, item) => sum + item.file.size, 0), [selectedFiles]);
  const isBusy = processMutation.isPending;
  const isDeletionBusy = deletionMutation.isPending;
  const isDuplicateBusy = duplicateMutation.isPending;

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).filter(file => /\.(xlsx|csv)$/i.test(file.name));
    if (incoming.length === 0) {
      toast.error("Please choose files in .csv or .xlsx format.");
      return;
    }
    setSelectedFiles(current => {
      const existing = new Set(current.map(item => item.file.name));
      const additions = incoming.filter(file => !existing.has(file.name)).map(file => ({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file }));
      return [...current, ...additions];
    });
    setResult(null);
  }

  function removeFile(id: string) {
    setSelectedFiles(current => current.filter(item => item.id !== id));
    setResult(null);
  }

  async function processDuplicateFile(file: File) {
    try {
      const data = await fileToBase64(file);
      duplicateMutation.mutate({ file: { name: file.name, data } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the duplicate workbook.");
    }
  }

  async function processEntitySummaryFile(file: File) {
    try {
      entitySummaryMutation.mutate({ file: { name: file.name, data: await fileToBase64(file) } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the workbook.");
    }
  }

  async function processAdditionExitMatch() {
    if (!originalMatchFile || !exitMatchFile) return;
    try {
      matchMutation.mutate({ original: { name: originalMatchFile.name, data: await fileToBase64(originalMatchFile) }, exit: { name: exitMatchFile.name, data: await fileToBase64(exitMatchFile) }, mapping: additionExitMapping });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the match files.");
    }
  }

  async function processOnboardMatch() {
    if (!onboardFile || !deletionCheckFile) return;
    try { onboardMutation.mutate({ onboard: { name: onboardFile.name, data: await fileToBase64(onboardFile) }, deletion: { name: deletionCheckFile.name, data: await fileToBase64(deletionCheckFile) }, mapping: onboardMapping }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not read the NRC match files."); }
  }

  async function processFileComparison() {
    if (!comparisonFile1 || !comparisonFile2) return;
    try {
      fileComparisonMutation.mutate({
        file1: { name: comparisonFile1.name, data: await fileToBase64(comparisonFile1) },
        file2: { name: comparisonFile2.name, data: await fileToBase64(comparisonFile2) },
        config: {
          file1Column1: comparisonSettings.file1Column1,
          file2Column1: comparisonSettings.file2Column1,
          enableSecondCondition: comparisonSettings.enableSecondCondition,
          file1Column2: comparisonSettings.enableSecondCondition ? comparisonSettings.file1Column2 : undefined,
          file2Column2: comparisonSettings.enableSecondCondition ? comparisonSettings.file2Column2 : undefined,
          operation: comparisonSettings.operation,
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the comparison files.");
    }
  }

  async function processReadyUpload() {
    if (!readyUploadFile) return;
    try { readyUploadMutation.mutate({ file: { name: readyUploadFile.name, data: await fileToBase64(readyUploadFile) } }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not read the upload file."); }
  }

  async function processFacilityFile() {
    if (!facilityFile) return;
    try { facilityMutation.mutate({ file: { name: facilityFile.name, data: await fileToBase64(facilityFile) } }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not read the facility workbook."); }
  }

  async function processDeletionFile(file: File) {
    try {
      const data = await fileToBase64(file);
      deletionMutation.mutate({ file: { name: file.name, data } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the deletion workbook.");
    }
  }

  async function processFiles() {
    if (selectedFiles.length === 0) return;
    if (totalSize > MAX_CONSOLIDATION_BYTES) {
      toast.error(`Master consolidation supports up to 3 MB total per request. Your selected files are ${formatBytes(totalSize)}. Remove a file or split the work into smaller batches.`);
      return;
    }
    try {
      const files = await Promise.all(selectedFiles.map(async ({ file }) => ({ name: file.name, data: await fileToBase64(file) })));
      processMutation.mutate({ files });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the selected files.");
    }
  }

  function reset() {
    setSelectedFiles([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function resetDuplicates() {
    setDuplicateFile(null);
    setDuplicateResult(null);
    if (duplicateInputRef.current) duplicateInputRef.current.value = "";
  }

  function resetEntitySummary() {
    setEntitySummaryFile(null);
    setEntitySummaryResult(null);
    if (entitySummaryInputRef.current) entitySummaryInputRef.current.value = "";
  }

  function resetDeletionSummary() {
    setDeletionFile(null);
    setDeletionSummary(null);
    if (deletionInputRef.current) deletionInputRef.current.value = "";
  }

  async function inspectColumns(file: File, setColumns: (columns: string[]) => void) {
    try {
      const inspection = await workbookColumnsMutation.mutateAsync({ file: { name: file.name, data: await fileToBase64(file) } });
      setColumns(inspection.columns);
    } catch (error) {
      setColumns([]);
      toast.error(getFriendlyApiMessage(error, "The column names could not be read. You can still try processing the file."));
    }
  }
  function validatePairedFile(file: File) { if (!/\.(xlsx|csv)$/i.test(file.name)) { toast.error("Please choose a .csv or .xlsx file."); return false; } return true; }
  function selectAdditionExitOriginal(file: File) { if (!validatePairedFile(file)) return; setOriginalMatchFile(file); setMatchResult(null); setAdditionExitOriginalColumns([]); void inspectColumns(file, setAdditionExitOriginalColumns); }
  function selectAdditionExitSecond(file: File) { if (!validatePairedFile(file)) return; setExitMatchFile(file); setMatchResult(null); setAdditionExitSecondColumns([]); void inspectColumns(file, setAdditionExitSecondColumns); }
  function selectOnboardOriginal(file: File) { if (!validatePairedFile(file)) return; setOnboardFile(file); setOnboardResult(null); setOnboardOriginalColumns([]); void inspectColumns(file, setOnboardOriginalColumns); }
  function selectOnboardSecond(file: File) { if (!validatePairedFile(file)) return; setDeletionCheckFile(file); setOnboardResult(null); setOnboardSecondColumns([]); void inspectColumns(file, setOnboardSecondColumns); }
  function selectComparisonFile1(file: File) { if (!validatePairedFile(file)) return; setComparisonFile1(file); setComparisonResult(null); setComparisonFile1Columns([]); void inspectColumns(file, setComparisonFile1Columns); }
  function selectComparisonFile2(file: File) { if (!validatePairedFile(file)) return; setComparisonFile2(file); setComparisonResult(null); setComparisonFile2Columns([]); void inspectColumns(file, setComparisonFile2Columns); }
  function resetAdditionExitMatch() { setOriginalMatchFile(null); setExitMatchFile(null); setMatchResult(null); setAdditionExitOriginalColumns([]); setAdditionExitSecondColumns([]); setAdditionExitMapping(EMPTY_PAIR_MAPPING); }
  function resetOnboardMatch() { setOnboardFile(null); setDeletionCheckFile(null); setOnboardResult(null); setOnboardOriginalColumns([]); setOnboardSecondColumns([]); setOnboardMapping(EMPTY_PAIR_MAPPING); }
  function resetFileComparison() { setComparisonFile1(null); setComparisonFile2(null); setComparisonResult(null); setComparisonFile1Columns([]); setComparisonFile2Columns([]); setComparisonSettings(EMPTY_FILE_COMPARISON_SETTINGS); }

  const isAnyWorkflowProcessing = processMutation.isPending || deletionMutation.isPending || duplicateMutation.isPending || entitySummaryMutation.isPending || matchMutation.isPending || fileComparisonMutation.isPending || onboardMutation.isPending || readyUploadMutation.isPending || facilityMutation.isPending || workbookColumnsMutation.isPending;
  const hasWorkingData = selectedFiles.length > 0 || Boolean(result || deletionSummary || deletionFile || duplicateFile || duplicateResult || entitySummaryFile || entitySummaryResult || originalMatchFile || exitMatchFile || matchResult || comparisonFile1 || comparisonFile2 || comparisonResult || onboardFile || deletionCheckFile || onboardResult || readyUploadFile || readyUploadResult || facilityFile || facilityResult);

  useEffect(() => {
    if (!hasWorkingData || isAnyWorkflowProcessing) return;
    const cleanupTimer = window.setTimeout(() => {
      setSelectedFiles([]);
      setResult(null);
      setDeletionSummary(null);
      setDeletionFile(null);
      setDuplicateFile(null);
      setDuplicateResult(null);
      setEntitySummaryFile(null);
      setEntitySummaryResult(null);
      setOriginalMatchFile(null);
      setExitMatchFile(null);
      setMatchResult(null);
      setAdditionExitOriginalColumns([]);
      setAdditionExitSecondColumns([]);
      setAdditionExitMapping(EMPTY_PAIR_MAPPING);
      setComparisonFile1(null);
      setComparisonFile2(null);
      setComparisonResult(null);
      setComparisonFile1Columns([]);
      setComparisonFile2Columns([]);
      setComparisonSettings(EMPTY_FILE_COMPARISON_SETTINGS);
      setOnboardFile(null);
      setDeletionCheckFile(null);
      setOnboardResult(null);
      setOnboardOriginalColumns([]);
      setOnboardSecondColumns([]);
      setOnboardMapping(EMPTY_PAIR_MAPPING);
      setReadyUploadFile(null);
      setReadyUploadResult(null);
      setFacilityFile(null);
      setFacilityResult(null);
      [inputRef, deletionInputRef, duplicateInputRef, entitySummaryInputRef, readyUploadInputRef, facilityInputRef].forEach(ref => { if (ref.current) ref.current.value = ""; });
      toast.info("Temporary workbook data was cleared after one minute of inactivity.");
    }, 60_000);
    return () => window.clearTimeout(cleanupTimer);
  }, [hasWorkingData, isAnyWorkflowProcessing, selectedFiles, result, deletionSummary, deletionFile, duplicateFile, duplicateResult, entitySummaryFile, entitySummaryResult, originalMatchFile, exitMatchFile, matchResult, comparisonFile1, comparisonFile2, comparisonResult, onboardFile, deletionCheckFile, onboardResult, readyUploadFile, readyUploadResult, facilityFile, facilityResult]);

  return (
    <main className={`app-shell tool-app-shell tool-${activeTool}`}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Layers3 size={19} /></div><div><p className="eyebrow">OPERATIONS TOOLKIT</p><h1>Excel Master File</h1></div></div>
        <div className="topbar-note"><ShieldCheck size={16} /> Files are processed securely on the server</div>
      </header>
      {activeWorkflowGuide && <section className="container workflow-guide-shell"><WorkflowGuide {...activeWorkflowGuide} /></section>}
      <section className="hero container">
        <div className="hero-copy"><Badge className="soft-badge">EXCEL OPERATIONS WORKSPACE</Badge><h2>Choose a workflow<br /><em>from the menu.</em></h2><p>Each tool has its own upload, preview, and download workspace. Select the process you need from the clearly visible navigation menu on the left.</p><details className="privacy-details" open><summary>Your file privacy</summary><p>Your selected CSV or XLSX file is used as temporary data for the workflow you choose. The tool processes it securely in memory, lets you review the result, and then returns the finished file for download. Uploaded workbooks, spreadsheet cells, previews, and generated files are not stored in this application database or file storage.</p></details></div>
        <div className="hero-meta"><div><strong>01</strong><span>Choose tool</span></div><div><strong>02</strong><span>Upload data</span></div><div><strong>03</strong><span>Review output</span></div></div>
      </section>
      <section className="container overview-suggestions" aria-label="Suggested workflows">
        <div className="overview-suggestions-heading"><Badge className="soft-badge">SUGGESTED NEXT STEPS</Badge><h2>What would you like to <em>work on?</em></h2><p>Start with the workflow that matches your spreadsheet task. You can preview every result before downloading it.</p></div>
        <div className="tool-card-grid">{TOOL_CARDS.slice(0, 4).map(tool => <Link key={tool.slug} href={`/tools/${tool.slug}`} className="tool-card-link"><article className="tool-menu-card"><span className="tool-menu-icon"><tool.icon size={20} /></span><div><h3>{tool.title}</h3><p>{tool.description}</p></div><span className="tool-menu-arrow">Open →</span></article></Link>)}</div>
      </section>
      <section className="container profile-dashboard" aria-label="Your profile">
        <div className="profile-dashboard-heading"><div><Badge className="soft-badge">YOUR PROFILE</Badge><h2>Keep your details <em>current and protected.</em></h2><p>Your sign-in identity is provided by your login service. The editable profile fields below are encrypted before database storage and are visible only to you.</p></div></div>
        {!isAuthenticated ? <Card className="profile-card"><CardContent className="profile-sign-in"><ShieldCheck size={25}/><div><strong>Sign in to manage your profile</strong><p>After signing in, you can save your preferred name, phone number, organization, and job title in your private dashboard.</p></div><Button className="process-button" onClick={() => setLocation("/login")}>Sign in</Button></CardContent></Card> : <Card className="profile-card"><CardContent className="profile-grid">{profileQuery.isLoading ? <div className="profile-loading"><Loader2 className="animate-spin" size={22}/><span>Loading your protected profile…</span></div> : profileQuery.error ? <div className="profile-sign-in"><ShieldCheck size={25}/><div><strong>Could not load your protected profile</strong><p>Your saved profile was not changed. Please retry the secure profile request.</p></div><Button className="process-button" onClick={() => profileQuery.refetch()}>Retry</Button></div> : <><aside className="identity-card"><div className="identity-avatar"><UserRound size={21}/></div><div><span>Signed-in identity</span><strong>{profileQuery.data?.identity.name || "Your account"}</strong><p>{profileQuery.data?.identity.email || "Email is managed by your sign-in provider"}</p></div><small>Identity information is managed by your sign-in provider and cannot be edited here.</small></aside><form className="profile-form" onSubmit={event => { event.preventDefault(); profileMutation.mutate(profileForm); }}><div className="profile-fields"><label><span><UserRound size={14}/> Preferred name</span><Input value={profileForm.displayName} maxLength={120} placeholder="How should we address you?" onChange={event => setProfileForm(current => ({ ...current, displayName: event.target.value }))}/></label><label><span><Phone size={14}/> Phone number</span><Input value={profileForm.phoneNumber} maxLength={40} placeholder="Optional contact number" onChange={event => setProfileForm(current => ({ ...current, phoneNumber: event.target.value }))}/></label><label><span><Building2 size={14}/> Organization</span><Input value={profileForm.organization} maxLength={160} placeholder="Company or team" onChange={event => setProfileForm(current => ({ ...current, organization: event.target.value }))}/></label><label><span><BriefcaseBusiness size={14}/> Job title</span><Input value={profileForm.jobTitle} maxLength={120} placeholder="Your role" onChange={event => setProfileForm(current => ({ ...current, jobTitle: event.target.value }))}/></label></div><div className="profile-save-row"><span><ShieldCheck size={14}/> Encrypted at rest · accessible only through your signed-in account</span><Button type="submit" className="process-button" disabled={profileMutation.isPending}>{profileMutation.isPending ? <><Loader2 className="animate-spin" size={16}/> Saving profile…</> : "Save profile"}</Button></div></form></>}</CardContent></Card>}
      </section>
      <section className="container process-dashboard" aria-label="Completed processes">
        <div className="process-dashboard-heading"><div><Badge className="soft-badge">PROCESS DASHBOARD</Badge><h2>Completed work, <em>without stored spreadsheet data.</em></h2><p>This dashboard saves only the tool used, completion status, file name metadata, safe totals, output filename, and completion time. It never saves uploaded workbook bytes, spreadsheet rows, previews, or generated Excel data.</p></div>{isAuthenticated && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="clear-history-button" disabled={(historyQuery.data?.length ?? 0) === 0}><Trash2 size={15}/> Clear history</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear saved process history?</AlertDialogTitle><AlertDialogDescription>This permanently deletes your completed-process metadata, including tool names, file name metadata, totals, output filenames, and times. It does not affect Excel files or downloads because they are not stored.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => clearHistoryMutation.mutate()}>Delete history</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>
        {!isAuthenticated ? <Card className="history-card"><CardContent className="history-empty"><ShieldCheck size={25}/><div><strong>Sign in to save your private process history</strong><p>Excel files remain temporary. Signing in saves only completed-run metadata to your own dashboard.</p></div><Button className="process-button" onClick={() => setLocation("/login")}>Sign in</Button></CardContent></Card> : <Card className="history-card"><CardContent>{historyQuery.isLoading ? <div className="history-empty"><Loader2 className="animate-spin" size={22}/><span>Loading process history…</span></div> : <><div className="history-metrics"><div><span>Completed runs</span><strong>{historyQuery.data?.length ?? 0}</strong></div><div><span>Tools used</span><strong>{toolTotals.length}</strong></div><div><span>Retention</span><strong>Metadata only</strong></div></div>{toolTotals.length > 0 && <div className="history-tool-totals">{toolTotals.map(([key, item]) => <div key={key}><span>{item.label}</span><strong>{item.count} completed</strong></div>)}</div>}{(historyQuery.data?.length ?? 0) === 0 ? <div className="history-empty"><FileSpreadsheet size={23}/><span>Your completed processes will appear here after you run a tool.</span></div> : <div className="history-list">{historyQuery.data?.map(item => <article className="history-row" key={item.id}><div className="history-status"><ShieldCheck size={17}/></div><div className="history-main"><strong>{item.toolName}</strong><span>{storedFileNames(item.inputFileNames)} · {item.totalRecords.toLocaleString()} records · {item.outputFilename}</span></div><time>{new Date(item.completedAt).toLocaleString()}</time></article>)}</div>}</>}</CardContent></Card>}
      </section>
      <section className="container tool-dashboard" aria-label="Excel workflow menu" aria-hidden="true">
        <div className="tool-dashboard-heading"><div><Badge className="soft-badge">SELECT A WORKFLOW</Badge><h2>One focused tool <em>at a time.</em></h2><p>Choose the Excel process you need. Each workspace keeps uploads, preview data, and downloads together without mixing tasks.</p></div></div>
        <div className="tool-card-grid">{TOOL_CARDS.map(tool => <Link key={tool.slug} href={`/tools/${tool.slug}`} className="tool-card-link"><article className="tool-menu-card"><span className="tool-menu-icon"><tool.icon size={20} /></span><div><h3>{tool.title}</h3><p>{tool.description}</p></div><span className="tool-menu-arrow">Open →</span></article></Link>)}</div>
      </section>
      <section className="container work-area tool-section tool-consolidation">
        <Card className="upload-card">
          <CardHeader><div className="section-kicker"><span className="step-number">01</span><span>Source workbooks</span></div><CardTitle>Upload your CSV or Excel files</CardTitle><CardDescription>Select all files for this consolidation run. The processor will find Addition and Deletion sheets even when their names include date ranges or minor variations.</CardDescription></CardHeader>
          <CardContent>
            <div className={`dropzone ${isDragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={event => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files); }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}>
              <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} multiple hidden onChange={event => event.target.files && addFiles(event.target.files)} />
              <div className="upload-icon"><FileUp size={22} /></div><h3>Drop CSV or XLSX files here</h3><p>or <span>browse from your computer</span></p><small>Supports .csv and .xlsx · Up to 3 MB total per request on Vercel</small>
            </div>
            {selectedFiles.length > 0 && <div className="file-list"><div className="file-list-heading"><span>{selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected</span><span>{formatBytes(totalSize)} total</span></div>{selectedFiles.map(({ id, file }) => <div className="file-row" key={id}><FileSpreadsheet size={18} className="file-symbol" /><div className="file-name"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div><button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(id)}><X size={16} /></button></div>)}</div>}
            <div className="action-row"><Button variant="ghost" onClick={reset} disabled={selectedFiles.length === 0 || isBusy}><RotateCcw size={16} /> Clear</Button><Button className="process-button" onClick={processFiles} disabled={selectedFiles.length === 0 || isBusy}>{isBusy ? <><Loader2 className="animate-spin" size={17} /> Building workbook…</> : <><Layers3 size={17} /> Merge and preview</>}</Button></div>
            {isBusy && <div className="progress-state"><Progress value={68} /><span>Reading sheets and preparing your consolidated workbook</span></div>}
          </CardContent>
        </Card>
        <Card className="result-card">
          <CardHeader><div className="section-kicker"><span className="step-number">02</span><span>Review & export</span></div><CardTitle>Your consolidated workbook</CardTitle><CardDescription>{result ? `Previewing the first rows from ${result.fileCount} processed file${result.fileCount === 1 ? "" : "s"}.` : "Your preview will appear here after processing. Nothing is downloaded until you choose to export it."}</CardDescription></CardHeader>
          <CardContent>{!result ? <div className="result-empty"><div className="empty-orbit"><FileSpreadsheet size={28} /></div><h3>Preview waiting</h3><p>Upload one or more workbooks, then select <strong>Merge and preview</strong> to inspect the combined sheets.</p></div> : <><div className="metric-grid"><div><span>Addition rows</span><strong>{result.additionCount.toLocaleString()}</strong></div><div><span>Deletion rows</span><strong>{result.deletionCount.toLocaleString()}</strong></div><div><span>Files read</span><strong>{result.fileCount.toLocaleString()}</strong></div></div><Tabs defaultValue="summary" className="preview-tabs"><TabsList><TabsTrigger value="summary">Summary Report</TabsTrigger><TabsTrigger value="addition">Addition</TabsTrigger><TabsTrigger value="deletion">Deletion</TabsTrigger></TabsList><TabsContent value="summary"><PreviewTable preview={result.summary} /></TabsContent><TabsContent value="addition"><PreviewTable preview={result.addition} /></TabsContent><TabsContent value="deletion"><PreviewTable preview={result.deletion} /></TabsContent></Tabs><div className="download-panel"><div><strong>Ready to export</strong><span>{result.outputFilename}</span></div><Button className="download-button" onClick={() => downloadResult(result)}><Download size={17} /> Download .xlsx</Button></div>{result.errors.length > 0 && <div className="warning-panel"><strong>Review notices</strong><span>{result.errors.join(" · ")}</span></div>}</>}</CardContent>
        </Card>
      </section>
      <section className="container deletion-section tool-section tool-deletion-summary">
        <div className="deletion-heading"><div><Badge className="soft-badge">DELETION SUMMARY LIST</Badge><h2>Turn deletion records into an <em>entity-level brief.</em></h2><p>Upload one deletion workbook to count each Entity Name, preserve the original deletion data, and export a focused summary report.</p></div><div className="deletion-heading-icon"><ListTree size={28} /></div></div>
        <Card className="deletion-card">
          <CardContent>
            <div className="deletion-grid">
              <div className="deletion-upload">
                <input ref={deletionInputRef} type="file" accept={ACCEPTED_TYPES} hidden onChange={event => { const file = event.target.files?.[0]; if (file) { setDeletionFile(file); setDeletionSummary(null); } }} />
                <div className="mini-dropzone" onClick={() => deletionInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") deletionInputRef.current?.click(); }}><div className="upload-icon"><ListTree size={20} /></div><strong>{deletionFile ? deletionFile.name : "Choose a deletion workbook"}</strong><span>{deletionFile ? formatBytes(deletionFile.size) : "One .csv or .xlsx file"}</span></div>
                <div className="action-row"><Button variant="ghost" onClick={resetDeletionSummary} disabled={!deletionFile || isDeletionBusy}><RotateCcw size={16} /> Clear</Button><Button className="process-button" onClick={() => deletionFile && processDeletionFile(deletionFile)} disabled={!deletionFile || isDeletionBusy}>{isDeletionBusy ? <><Loader2 className="animate-spin" size={17} /> Counting entities…</> : <><ListTree size={17} /> Build summary list</>}</Button></div>
              </div>
              <div className="deletion-result">{!deletionSummary ? <div className="deletion-empty"><ListTree size={25} /><strong>Summary preview waiting</strong><span>Choose a workbook to see deletion counts grouped by Entity Name.</span></div> : <><div className="deletion-metrics"><div><span>Unique entities</span><strong>{deletionSummary.uniqueEntityCount.toLocaleString()}</strong></div><div><span>Deletion rows</span><strong>{deletionSummary.deletionRowCount.toLocaleString()}</strong></div><div><span>Entity column</span><strong>{deletionSummary.entityColumn}</strong></div></div><Tabs defaultValue="entity-summary" className="preview-tabs"><TabsList><TabsTrigger value="entity-summary">Entity Summary</TabsTrigger><TabsTrigger value="deletion-data">Deletion Data</TabsTrigger></TabsList><TabsContent value="entity-summary"><PreviewTable preview={deletionSummary.summary} /></TabsContent><TabsContent value="deletion-data"><PreviewTable preview={deletionSummary.deletionData} /></TabsContent></Tabs><div className="download-panel"><div><strong>Ready to export</strong><span>{deletionSummary.outputFilename}</span></div><Button className="download-button" onClick={() => downloadBytes(deletionSummary.workbookBase64, deletionSummary.outputFilename)}><Download size={17} /> Download summary</Button></div></>}</div>
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="container duplicate-section tool-section tool-duplicates">
        <div className="deletion-heading"><div><Badge className="soft-badge">DUPLICATE SEPARATION</Badge><h2>Keep one clean record and <em>move the repeats.</em></h2><p>Upload a deletion list to identify repeated Employee Full Name and NRC No combinations. The first occurrence stays in Clean Data; later occurrences move to Duplicates Moved.</p></div><div className="deletion-heading-icon"><Layers3 size={28} /></div></div>
        <Card className="deletion-card">
          <CardContent>
            <div className="deletion-grid">
              <div className="deletion-upload">
                <input ref={duplicateInputRef} type="file" accept={ACCEPTED_TYPES} hidden onChange={event => { const file = event.target.files?.[0]; if (file) { setDuplicateFile(file); setDuplicateResult(null); } }} />
                <div className="mini-dropzone" onClick={() => duplicateInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") duplicateInputRef.current?.click(); }}><div className="upload-icon"><Layers3 size={20} /></div><strong>{duplicateFile ? duplicateFile.name : "Choose a deletion list"}</strong><span>{duplicateFile ? formatBytes(duplicateFile.size) : "One .csv or .xlsx file"}</span></div>
                <div className="action-row"><Button variant="ghost" onClick={resetDuplicates} disabled={!duplicateFile || isDuplicateBusy}><RotateCcw size={16} /> Clear</Button><Button className="process-button" onClick={() => duplicateFile && processDuplicateFile(duplicateFile)} disabled={!duplicateFile || isDuplicateBusy}>{isDuplicateBusy ? <><Loader2 className="animate-spin" size={17} /> Separating duplicates…</> : <><Layers3 size={17} /> Separate duplicate list</>}</Button></div>
              </div>
              <div className="deletion-result">{!duplicateResult ? <div className="deletion-empty"><Layers3 size={25} /><strong>Duplicate preview waiting</strong><span>Choose a workbook to compare Employee Full Name and NRC No.</span></div> : <><div className="deletion-metrics"><div><span>Clean rows</span><strong>{duplicateResult.cleanCount.toLocaleString()}</strong></div><div><span>Duplicates moved</span><strong>{duplicateResult.duplicateCount.toLocaleString()}</strong></div><div><span>Matched columns</span><strong>{duplicateResult.nameColumn} · {duplicateResult.nrcColumn}</strong></div></div><Tabs defaultValue="clean" className="preview-tabs"><TabsList><TabsTrigger value="clean">Clean Data</TabsTrigger><TabsTrigger value="duplicates">Duplicates Moved</TabsTrigger></TabsList><TabsContent value="clean"><PreviewTable preview={duplicateResult.cleanData} /></TabsContent><TabsContent value="duplicates"><PreviewTable preview={duplicateResult.duplicates} /></TabsContent></Tabs><div className="download-panel"><div><strong>Ready to export</strong><span>{duplicateResult.outputFilename}</span></div><Button className="download-button" onClick={() => downloadBytes(duplicateResult.workbookBase64, duplicateResult.outputFilename)}><Download size={17} /> Download separated list</Button></div></>}</div>
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="container duplicate-section tool-section tool-entity-summary">
        <div className="deletion-heading"><div><Badge className="soft-badge">DELETION WITH THE SUMMARY</Badge><h2>See every entity <em>across every sheet.</em></h2><p>Upload an exported workbook to create one Entity Summary while preserving every source worksheet.</p></div><div className="deletion-heading-icon"><ListTree size={28} /></div></div>
        <Card className="deletion-card"><CardContent><div className="deletion-grid"><div className="deletion-upload"><input ref={entitySummaryInputRef} type="file" accept={ACCEPTED_TYPES} hidden onChange={event => { const file = event.target.files?.[0]; if (file) { setEntitySummaryFile(file); setEntitySummaryResult(null); } }} /><div className="mini-dropzone" onClick={() => entitySummaryInputRef.current?.click()} role="button" tabIndex={0}><div className="upload-icon"><ListTree size={20} /></div><strong>{entitySummaryFile ? entitySummaryFile.name : "Choose a multi-sheet workbook"}</strong><span>{entitySummaryFile ? formatBytes(entitySummaryFile.size) : "One .csv or .xlsx file"}</span></div><div className="action-row"><Button variant="ghost" onClick={resetEntitySummary} disabled={!entitySummaryFile || entitySummaryMutation.isPending}><RotateCcw size={16} /> Clear</Button><Button className="process-button" onClick={() => entitySummaryFile && processEntitySummaryFile(entitySummaryFile)} disabled={!entitySummaryFile || entitySummaryMutation.isPending}>{entitySummaryMutation.isPending ? <><Loader2 className="animate-spin" size={17} /> Building summary…</> : <><ListTree size={17} /> Build entity summary</>}</Button></div></div><div className="deletion-result">{!entitySummaryResult ? <div className="deletion-empty"><ListTree size={25} /><strong>Entity summary preview waiting</strong><span>Choose a multi-sheet workbook to compare entity counts.</span></div> : <><div className="deletion-metrics"><div><span>Source sheets</span><strong>{entitySummaryResult.sourceSheetCount}</strong></div><div><span>Unique entities</span><strong>{entitySummaryResult.entityCount}</strong></div><div><span>Output</span><strong>Entity Summary</strong></div></div><PreviewTable preview={entitySummaryResult.summary} /><div className="download-panel"><div><strong>Ready to export</strong><span>{entitySummaryResult.outputFilename}</span></div><Button className="download-button" onClick={() => downloadBytes(entitySummaryResult.workbookBase64, entitySummaryResult.outputFilename)}><Download size={17} /> Download summary</Button></div></>}</div></div></CardContent></Card>
      </section>
      <section className="container duplicate-section tool-section tool-addition-exit">
        <div className="deletion-heading"><div><Badge className="soft-badge">ADDITION ORIGINAL & EXIT MATCH</Badge><h2>Validate exit data against <em>the original addition list.</em></h2><p>Upload the original Addition workbook and the Exit Data workbook. Mobile matching is prioritized before NRC matching, and every result is grouped for review.</p></div><div className="deletion-heading-icon"><Layers3 size={28} /></div></div>
        <Card className="deletion-card paired-workflow-card"><CardContent><div className="paired-workflow-layout"><PairedFileUploadPanel originalFile={originalMatchFile} secondFile={exitMatchFile} originalLabel="Original File" originalDescription="Original Addition source" secondLabel="2nd File" secondDescription="Exit data to validate" originalColumns={additionExitOriginalColumns} secondColumns={additionExitSecondColumns} mapping={additionExitMapping} isInspecting={workbookColumnsMutation.isPending} isProcessing={matchMutation.isPending} processingMessage="Parsing and matching…" onOriginalFile={selectAdditionExitOriginal} onSecondFile={selectAdditionExitSecond} onMappingChange={(field, value) => setAdditionExitMapping(current => ({ ...current, [field]: value }))} onProcess={processAdditionExitMatch} onReset={resetAdditionExitMatch} /><div className="deletion-result">{!matchResult ? <div className="deletion-empty"><Layers3 size={25} /><strong>Match report preview waiting</strong><span>Add both files, optionally confirm columns, then select <strong>Parse and preview</strong>.</span></div> : <><div className="deletion-metrics">{Object.entries(matchResult.groups).map(([name, value]) => <div key={name}><span>{name}</span><strong>{value.rows.length}</strong></div>)}</div><Tabs defaultValue="summary" className="preview-tabs"><TabsList><TabsTrigger value="summary">Summary</TabsTrigger>{Object.keys(matchResult.groups).map((name,index) => <TabsTrigger key={name} value={`group-${index}`}>{name}</TabsTrigger>)}</TabsList><TabsContent value="summary"><PreviewTable preview={matchResult.summary} /></TabsContent>{Object.entries(matchResult.groups).map(([name,value],index) => <TabsContent key={name} value={`group-${index}`}><PreviewTable preview={value} /></TabsContent>)}</Tabs><div className="download-panel paired-export-panel"><div><strong>Multi-sheet Excel output is ready</strong><span>{matchResult.outputFilename}</span></div><div><Button variant="outline" onClick={resetAdditionExitMatch}><RotateCcw size={16}/> Process new files</Button><Button className="download-button" onClick={() => downloadBytes(matchResult.workbookBase64, matchResult.outputFilename)}><Download size={17} /> Download Excel output</Button></div></div></>}</div></div></CardContent></Card>
      </section>
      <section className="container duplicate-section tool-section tool-file-comparison">
        <div className="deletion-heading"><div><Badge className="soft-badge">MULTI-CONDITION FILE COMPARE</Badge><h2>Compare two workbooks with <em>one or two conditions.</em></h2><p>Upload File 1 and File 2, choose the columns to match, optionally add a second condition, then run exists, duplicate, or missing-record analysis.</p></div><div className="deletion-heading-icon"><GitCompare size={28} /></div></div>
        <Card className="deletion-card paired-workflow-card"><CardContent><div className="paired-workflow-layout"><ConditionalFileComparisonPanel file1={comparisonFile1} file2={comparisonFile2} file1Columns={comparisonFile1Columns} file2Columns={comparisonFile2Columns} settings={comparisonSettings} isInspecting={workbookColumnsMutation.isPending} isProcessing={fileComparisonMutation.isPending} processingMessage="Running comparison…" onFile1={selectComparisonFile1} onFile2={selectComparisonFile2} onSettingsChange={(field, value) => setComparisonSettings(current => ({ ...current, [field]: value }))} onProcess={processFileComparison} onReset={resetFileComparison} /><div className="deletion-result">{!comparisonResult ? <div className="deletion-empty"><GitCompare size={25} /><strong>Comparison preview waiting</strong><span>Add both files, choose your columns and operation, then select <strong>Run analysis</strong>.</span></div> : <><div className="deletion-metrics"><div><span>Operation</span><strong>{comparisonResult.operationLabel}</strong></div><div><span>File 1 rows</span><strong>{comparisonResult.file1RowCount.toLocaleString()}</strong></div><div><span>Result rows</span><strong>{comparisonResult.resultRowCount.toLocaleString()}</strong></div></div><Tabs defaultValue="summary" className="preview-tabs"><TabsList><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="result">Result</TabsTrigger></TabsList><TabsContent value="summary"><PreviewTable preview={comparisonResult.summary} /></TabsContent><TabsContent value="result"><PreviewTable preview={comparisonResult.result} /></TabsContent></Tabs><div className="download-panel paired-export-panel"><div><strong>Comparison workbook is ready</strong><span>{comparisonResult.outputFilename}</span></div><div><Button variant="outline" onClick={resetFileComparison}><RotateCcw size={16}/> Process new files</Button><Button className="download-button" onClick={() => downloadBytes(comparisonResult.workbookBase64, comparisonResult.outputFilename)}><Download size={17} /> Download Excel output</Button></div></div></>}</div></div></CardContent></Card>
      </section>
      <section className="container duplicate-section tool-section tool-onboard"><div className="deletion-heading"><div><Badge className="soft-badge">DELETION CHECK WITH ONBOARD</Badge><h2>Check deletion NRCs against <em>onboard records.</em></h2><p>Upload onboard data and a deletion list to enrich NRC matches and separate unmatched records.</p></div><div className="deletion-heading-icon"><ListTree size={28}/></div></div><Card className="deletion-card paired-workflow-card"><CardContent><div className="paired-workflow-layout"><PairedFileUploadPanel originalFile={onboardFile} secondFile={deletionCheckFile} originalLabel="Original File" originalDescription="Original onboard source" secondLabel="2nd File" secondDescription="Deletion file to check" originalColumns={onboardOriginalColumns} secondColumns={onboardSecondColumns} mapping={onboardMapping} showPhoneMapping={false} isInspecting={workbookColumnsMutation.isPending} isProcessing={onboardMutation.isPending} processingMessage="Parsing NRC data…" onOriginalFile={selectOnboardOriginal} onSecondFile={selectOnboardSecond} onMappingChange={(field, value) => setOnboardMapping(current => ({ ...current, [field]: value }))} onProcess={processOnboardMatch} onReset={resetOnboardMatch} /><div className="deletion-result">{!onboardResult?<div className="deletion-empty"><ListTree size={25}/><strong>NRC report preview waiting</strong><span>Add both files, optionally confirm columns, then select <strong>Parse and preview</strong>.</span></div>:<><Tabs defaultValue="summary" className="preview-tabs"><TabsList><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="matched">Matched</TabsTrigger><TabsTrigger value="no-match">No Match</TabsTrigger></TabsList><TabsContent value="summary"><PreviewTable preview={onboardResult.summary}/></TabsContent><TabsContent value="matched"><PreviewTable preview={onboardResult.matched}/></TabsContent><TabsContent value="no-match"><PreviewTable preview={onboardResult.noMatch}/></TabsContent></Tabs><div className="download-panel paired-export-panel"><div><strong>Multi-sheet Excel output is ready</strong><span>{onboardResult.outputFilename}</span></div><div><Button variant="outline" onClick={resetOnboardMatch}><RotateCcw size={16}/> Process new files</Button><Button className="download-button" onClick={()=>downloadBytes(onboardResult.workbookBase64,onboardResult.outputFilename)}><Download size={17}/> Download Excel output</Button></div></div></>}</div></div></CardContent></Card></section>
      <section className="container duplicate-section tool-section tool-ready-upload"><div className="deletion-heading"><div><Badge className="soft-badge">READY FILE TO UPLOAD</Badge><h2>Convert employee data into an <em>upload-ready file.</em></h2><p>Rename source fields, normalize dates, insert required blank fields, and apply the final upload schema in one downloadable workbook.</p></div><div className="deletion-heading-icon"><FileSpreadsheet size={28}/></div></div><Card className="deletion-card"><CardContent><div className="deletion-grid"><div className="deletion-upload"><input ref={readyUploadInputRef} type="file" accept={ACCEPTED_TYPES} hidden onChange={e=>{const f=e.target.files?.[0];if(f){setReadyUploadFile(f);setReadyUploadResult(null)}}}/><div className="mini-dropzone" onClick={()=>readyUploadInputRef.current?.click()}><div className="upload-icon"><FileUp size={20}/></div><strong>{readyUploadFile?readyUploadFile.name:'Choose employee source file'}</strong><span>{readyUploadFile?formatBytes(readyUploadFile.size):'One .csv or .xlsx file'}</span></div><div className="action-row"><Button className="process-button" onClick={processReadyUpload} disabled={!readyUploadFile||readyUploadMutation.isPending}>{readyUploadMutation.isPending?<><Loader2 className="animate-spin" size={17}/> Converting…</>:<><FileSpreadsheet size={17}/> Convert and preview</>}</Button></div></div><div className="deletion-result">{!readyUploadResult?<div className="deletion-empty"><FileSpreadsheet size={25}/><strong>Upload-ready preview waiting</strong><span>Choose an employee file to apply the target upload schema.</span></div>:<><div className="deletion-metrics"><div><span>Rows</span><strong>{readyUploadResult.rowCount}</strong></div><div><span>Final columns</span><strong>{readyUploadResult.columnCount}</strong></div><div><span>Date format</span><strong>MM/DD/YYYY</strong></div></div><PreviewTable preview={readyUploadResult.preview}/><div className="download-panel"><div><strong>Ready to export</strong><span>{readyUploadResult.outputFilename}</span></div><Button className="download-button" onClick={()=>downloadBytes(readyUploadResult.workbookBase64,readyUploadResult.outputFilename)}><Download size={17}/> Download ready file</Button></div></>}</div></div></CardContent></Card></section>
      <section className="container duplicate-section tool-section tool-facility"><div className="deletion-heading"><div><Badge className="soft-badge">ADDITION CONVERT FACILITY BY FACILITY</Badge><h2>Split addition records <em>facility by facility.</em></h2><p>Upload an Addition workbook to create an entity summary, retain all data, and export one worksheet for every Entity Name.</p></div><div className="deletion-heading-icon"><Layers3 size={28}/></div></div><Card className="deletion-card"><CardContent><div className="deletion-grid"><div className="deletion-upload"><input ref={facilityInputRef} type="file" accept={ACCEPTED_TYPES} hidden onChange={e=>{const f=e.target.files?.[0];if(f){setFacilityFile(f);setFacilityResult(null)}}}/><div className="mini-dropzone" onClick={()=>facilityInputRef.current?.click()}><div className="upload-icon"><FileUp size={20}/></div><strong>{facilityFile?facilityFile.name:'Choose Addition facility file'}</strong><span>{facilityFile?formatBytes(facilityFile.size):'One .csv or .xlsx file'}</span></div><div className="action-row"><Button className="process-button" onClick={processFacilityFile} disabled={!facilityFile||facilityMutation.isPending}>{facilityMutation.isPending?<><Loader2 className="animate-spin" size={17}/> Creating tabs…</>:<><Layers3 size={17}/> Convert by facility</>}</Button></div></div><div className="deletion-result">{!facilityResult?<div className="deletion-empty"><Layers3 size={25}/><strong>Facility summary preview waiting</strong><span>Choose an Addition file to create facility sheets.</span></div>:<><div className="deletion-metrics"><div><span>Facilities</span><strong>{facilityResult.facilityCount}</strong></div><div><span>Total records</span><strong>{facilityResult.recordCount}</strong></div><div><span>Workbook tabs</span><strong>{facilityResult.facilityCount+2}</strong></div></div><PreviewTable preview={facilityResult.summary}/><div className="download-panel"><div><strong>Ready to export</strong><span>{facilityResult.outputFilename}</span></div><Button className="download-button" onClick={()=>downloadBytes(facilityResult.workbookBase64,facilityResult.outputFilename)}><Download size={17}/> Download facility workbook</Button></div></>}</div></div></CardContent></Card></section>
    </main>
  );
}
