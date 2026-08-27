import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { getFriendlyApiMessage } from "@/lib/apiFeedback";
import { CalendarDays, Clock3, Download, FileJson2, Loader2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AccountManagement() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [isExporting, setIsExporting] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [retentionValue, setRetentionValue] = useState("unlimited");
  const exportInput = useMemo(() => startDate || endDate ? { startDate: startDate || undefined, endDate: endDate || undefined } : undefined, [startDate, endDate]);
  const exportQuery = trpc.profile.export.useQuery(exportInput, { enabled: false, retry: false });
  const retentionQuery = trpc.processHistory.retention.get.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  useEffect(() => { if (retentionQuery.data) setRetentionValue(retentionQuery.data.retentionDays === null ? "unlimited" : String(retentionQuery.data.retentionDays)); }, [retentionQuery.data]);
  const retentionMutation = trpc.processHistory.retention.update.useMutation({
    onSuccess: data => { utils.processHistory.retention.get.invalidate(); utils.processHistory.list.invalidate(); toast.success(data.deletedCount > 0 ? `${data.deletedCount} expired process record${data.deletedCount === 1 ? "" : "s"} removed.` : "Retention setting saved."); },
    onError: error => toast.error(getFriendlyApiMessage(error, "Retention setting could not be saved. Please try again.")),
  });
  const deleteProfile = trpc.profile.delete.useMutation({
    onSuccess: data => {
      utils.profile.me.invalidate();
      toast.success(data.deletedCount === 1 ? "Your editable profile data has been deleted." : "No editable profile data was stored.");
    },
    onError: error => toast.error(getFriendlyApiMessage(error, "Your profile data could not be deleted. Please try again.")),
  });

  async function exportProfile() {
    if (startDate && endDate && startDate > endDate) { toast.error("Start date must be on or before end date."); return; }
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      if (!result.data) throw result.error ?? new Error("Profile export was unavailable");
      const dateSuffix = startDate || endDate ? `-${startDate || "start"}-to-${endDate || "today"}` : "";
      downloadJson(result.data, `excel-master-file-account-data${dateSuffix}.json`);
      toast.success("Your account data export is ready.");
    } catch (error) {
      toast.error(getFriendlyApiMessage(error, "Your account data could not be exported. Please try again."));
    } finally {
      setIsExporting(false);
    }
  }

  function saveRetention() {
    retentionMutation.mutate({ retentionDays: retentionValue === "unlimited" ? null : Number(retentionValue) as 7 | 30 | 90 | 180 | 365 });
  }

  return <main className="account-page container">
    <section className="account-hero"><Badge className="soft-badge">ACCOUNT MANAGEMENT</Badge><h1>Your profile, <em>under your control.</em></h1><p>Export a copy of your sign-in identity, editable profile details, and completed-process metadata, or permanently delete only the encrypted profile fields you entered in this application.</p></section>
    {!isAuthenticated ? <Card className="account-card"><CardContent className="account-signin"><ShieldCheck size={27}/><div><strong>Sign in to manage your data</strong><p>Account controls are available only to the signed-in user.</p></div><Button className="process-button" onClick={() => startLogin()}>Sign in</Button></CardContent></Card> : <><Card className="account-card retention-card"><CardContent><div className="retention-heading"><div className="account-icon account-icon-retention"><Clock3 size={22}/></div><div><h2>Process-history retention</h2><p>Choose how long to keep your saved process metadata. Cleanup happens whenever you open your history or export account data. It never affects uploaded workbooks or spreadsheet contents.</p></div></div><div className="retention-controls"><label><span>Keep process metadata for</span><select value={retentionValue} onChange={event => setRetentionValue(event.target.value)} disabled={retentionQuery.isLoading || retentionMutation.isPending}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option><option value="unlimited">Unlimited — until I clear it</option></select></label><Button className="process-button" onClick={saveRetention} disabled={retentionQuery.isLoading || retentionMutation.isPending}>{retentionMutation.isPending ? <><Loader2 className="animate-spin" size={16}/> Saving…</> : "Save retention"}</Button></div></CardContent></Card><div className="account-grid"><Card className="account-card"><CardContent><div className="account-icon account-icon-export"><FileJson2 size={22}/></div><h2>Export account data</h2><p>Download a JSON copy containing your sign-in name and email, editable profile details, and your completed-process metadata: tool names, status, source-file names, totals, output names, and completion times.</p><div className="account-date-grid"><label><span><CalendarDays size={13}/> From date</span><input type="date" value={startDate} max={endDate || undefined} onChange={event => setStartDate(event.target.value)}/></label><label><span><CalendarDays size={13}/> To date</span><input type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)}/></label></div><button type="button" className="account-clear-dates" onClick={() => { setStartDate(""); setEndDate(""); }} disabled={!startDate && !endDate}>Clear date filter</button><div className="account-note"><ShieldCheck size={14}/><span>This excludes uploaded Excel files, worksheet contents, previews, and generated workbook data.</span></div><Button className="process-button account-action" onClick={exportProfile} disabled={isExporting}>{isExporting ? <><Loader2 className="animate-spin" size={16}/> Preparing export…</> : <><Download size={16}/> Download account JSON</>}</Button></CardContent></Card><Card className="account-card account-danger"><CardContent><div className="account-icon account-icon-delete"><Trash2 size={22}/></div><h2>Delete editable profile data</h2><p>Permanently remove the encrypted preferred name, phone number, organization, and job title saved for this account. Your sign-in identity, login account, process history, Excel downloads, and temporary uploads are not affected.</p><div className="account-note account-note-danger"><ShieldCheck size={14}/><span>This action cannot be undone, but you can add new profile details later.</span></div><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="account-delete-button" disabled={deleteProfile.isPending}><Trash2 size={16}/> Delete my profile data</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete your editable profile data?</AlertDialogTitle><AlertDialogDescription>This permanently removes the encrypted profile fields saved by this application. It does not delete your sign-in account, provider-managed name/email, process-history metadata, uploaded workbooks, or downloaded Excel files.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteProfile.mutate()}>Delete profile data</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card></div></>}
    <section className="account-scope"><UserRound size={18}/><div><strong>What this page manages</strong><p>The export contains profile information plus completed-process metadata only. Authentication details are managed by your sign-in provider; Excel files and workbook data are never persisted by this application.</p></div></section>
  </main>;
}
