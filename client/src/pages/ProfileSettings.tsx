import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { getFriendlyApiMessage } from "@/lib/apiFeedback";
import { BriefcaseBusiness, Building2, Clock3, FileSpreadsheet, History, Loader2, Phone, Settings2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

type EditableProfile = { displayName: string; phoneNumber: string; organization: string; jobTitle: string };

function storedFileNames(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).join(", ") : "";
  } catch {
    return "";
  }
}

export default function ProfileSettings() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.me.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const historyQuery = trpc.processHistory.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const retentionQuery = trpc.processHistory.retention.get.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const [profileForm, setProfileForm] = useState<EditableProfile>({ displayName: "", phoneNumber: "", organization: "", jobTitle: "" });
  const [retentionValue, setRetentionValue] = useState("unlimited");

  useEffect(() => {
    if (profileQuery.data) setProfileForm(profileQuery.data.profile ?? { displayName: "", phoneNumber: "", organization: "", jobTitle: "" });
  }, [profileQuery.data]);
  useEffect(() => {
    if (retentionQuery.data) setRetentionValue(retentionQuery.data.retentionDays === null ? "unlimited" : String(retentionQuery.data.retentionDays));
  }, [retentionQuery.data]);

  const profileMutation = trpc.profile.update.useMutation({
    onSuccess: () => { utils.profile.me.invalidate(); toast.success("Your profile has been saved securely."); },
    onError: error => toast.error(getFriendlyApiMessage(error, "Your profile could not be saved. Please try again.")),
  });
  const retentionMutation = trpc.processHistory.retention.update.useMutation({
    onSuccess: data => {
      utils.processHistory.retention.get.invalidate();
      utils.processHistory.list.invalidate();
      toast.success(data.deletedCount > 0 ? `${data.deletedCount} expired process record${data.deletedCount === 1 ? "" : "s"} removed.` : "History retention saved.");
    },
    onError: error => toast.error(getFriendlyApiMessage(error, "History retention could not be saved. Please try again.")),
  });
  const clearHistoryMutation = trpc.processHistory.clear.useMutation({
    onSuccess: data => { utils.processHistory.list.invalidate(); toast.success(`${data.deletedCount} process record${data.deletedCount === 1 ? "" : "s"} deleted.`); },
    onError: error => toast.error(getFriendlyApiMessage(error, "Process history could not be cleared. Please try again.")),
  });

  const toolTotals = useMemo(() => Object.entries((historyQuery.data ?? []).reduce<Record<string, { label: string; count: number }>>((totals, item) => {
    totals[item.toolKey] = totals[item.toolKey] ?? { label: item.toolName, count: 0 };
    totals[item.toolKey].count += 1;
    return totals;
  }, {})), [historyQuery.data]);

  if (!isAuthenticated) {
    return <main className="profile-settings-page container"><section className="profile-settings-hero"><Badge className="soft-badge">PROFILE & ACCOUNT</Badge><h1>Your account, <em>in one private place.</em></h1><p>Sign in to update your protected profile, choose your process-history retention, and see completed Excel tasks.</p></section><Card className="profile-card"><CardContent className="profile-sign-in"><ShieldCheck size={25}/><div><strong>Sign in to open your profile</strong><p>Profile settings and process history are available only to your signed-in account.</p></div><Button className="process-button" onClick={() => setLocation("/login?returnTo=%2Fprofile")}>Sign in</Button></CardContent></Card></main>;
  }

  return <main className="profile-settings-page container">
    <section className="profile-settings-hero"><Badge className="soft-badge">PROFILE & ACCOUNT</Badge><h1>Your account, <em>in one private place.</em></h1><p>Manage encrypted profile details, choose how long your process metadata is retained, and review your completed Excel tasks. Workbook contents remain temporary and are never shown here.</p></section>

    <section className="profile-settings-section" aria-label="Profile settings">
      <div className="profile-settings-heading"><div><h2>Profile settings</h2><p>Editable details are encrypted before they are stored. Your provider-managed sign-in identity remains read-only.</p></div></div>
      <Card className="profile-card"><CardContent className="profile-grid">{profileQuery.isLoading ? <div className="profile-loading"><Loader2 className="animate-spin" size={22}/><span>Loading your protected profile…</span></div> : profileQuery.error ? <div className="profile-sign-in"><ShieldCheck size={25}/><div><strong>Could not load your protected profile</strong><p>Your saved profile was not changed. Please retry the secure profile request.</p></div><Button className="process-button" onClick={() => profileQuery.refetch()}>Retry</Button></div> : <><aside className="identity-card"><div className="identity-avatar"><UserRound size={21}/></div><div><span>Signed-in identity</span><strong>{profileQuery.data?.identity.name || "Your account"}</strong><p>{profileQuery.data?.identity.email || "Email is managed by your sign-in provider"}</p></div><small>Identity information is managed by your sign-in provider and cannot be edited here.</small></aside><form className="profile-form" onSubmit={event => { event.preventDefault(); profileMutation.mutate(profileForm); }}><div className="profile-fields"><label><span><UserRound size={14}/> Preferred name</span><Input value={profileForm.displayName} maxLength={120} placeholder="How should we address you?" onChange={event => setProfileForm(current => ({ ...current, displayName: event.target.value }))}/></label><label><span><Phone size={14}/> Phone number</span><Input value={profileForm.phoneNumber} maxLength={40} placeholder="Optional contact number" onChange={event => setProfileForm(current => ({ ...current, phoneNumber: event.target.value }))}/></label><label><span><Building2 size={14}/> Organization</span><Input value={profileForm.organization} maxLength={160} placeholder="Company or team" onChange={event => setProfileForm(current => ({ ...current, organization: event.target.value }))}/></label><label><span><BriefcaseBusiness size={14}/> Job title</span><Input value={profileForm.jobTitle} maxLength={120} placeholder="Your role" onChange={event => setProfileForm(current => ({ ...current, jobTitle: event.target.value }))}/></label></div><div className="profile-save-row"><span><ShieldCheck size={14}/> Encrypted at rest · accessible only through your signed-in account</span><Button type="submit" className="process-button" disabled={profileMutation.isPending}>{profileMutation.isPending ? <><Loader2 className="animate-spin" size={16}/> Saving profile…</> : "Save profile"}</Button></div></form></>}</CardContent></Card>
    </section>

    <section className="profile-settings-grid" aria-label="Account and history settings">
      <Card className="profile-settings-card"><CardContent><div className="profile-settings-icon"><Settings2 size={21}/></div><h2>Account settings</h2><p>Choose how long to retain completed-process metadata. Download your account JSON or remove encrypted profile values from Account management.</p><label className="profile-retention-control"><span><Clock3 size={14}/> Keep process metadata for</span><select value={retentionValue} onChange={event => setRetentionValue(event.target.value)} disabled={retentionQuery.isLoading || retentionMutation.isPending}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option><option value="unlimited">Unlimited — until I clear it</option></select></label><Button className="process-button" onClick={() => retentionMutation.mutate({ retentionDays: retentionValue === "unlimited" ? null : Number(retentionValue) as 7 | 30 | 90 | 180 | 365 })} disabled={retentionQuery.isLoading || retentionMutation.isPending}>{retentionMutation.isPending ? <><Loader2 className="animate-spin" size={16}/> Saving…</> : "Save retention"}</Button><Link href="/account" className="profile-account-link">Open account export & data controls →</Link></CardContent></Card>

      <Card className="profile-settings-card profile-history-card"><CardContent><div className="profile-settings-card-heading"><div><div className="profile-settings-icon"><History size={21}/></div><h2>Past file processing</h2></div><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="clear-history-button" disabled={(historyQuery.data?.length ?? 0) === 0}><Trash2 size={15}/> Clear history</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear saved process history?</AlertDialogTitle><AlertDialogDescription>This permanently deletes your completed-process metadata, including tool names, file name metadata, totals, output filenames, and times. It does not affect Excel files or downloads because they are not stored.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => clearHistoryMutation.mutate()}>Delete history</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div><p>Only completed-task metadata is listed below. Uploaded workbooks, worksheet rows, previews, and generated files are never saved.</p>{historyQuery.isLoading ? <div className="history-empty"><Loader2 className="animate-spin" size={22}/><span>Loading process history…</span></div> : <><div className="history-metrics"><div><span>Completed runs</span><strong>{historyQuery.data?.length ?? 0}</strong></div><div><span>Tools used</span><strong>{toolTotals.length}</strong></div><div><span>Stored data</span><strong>Metadata only</strong></div></div>{toolTotals.length > 0 && <div className="history-tool-totals">{toolTotals.map(([key, item]) => <div key={key}><span>{item.label}</span><strong>{item.count} completed</strong></div>)}</div>}{(historyQuery.data?.length ?? 0) === 0 ? <div className="history-empty"><FileSpreadsheet size={23}/><span>Your completed processes will appear here after you run a tool.</span></div> : <div className="history-list">{historyQuery.data?.map(item => <article className="history-row" key={item.id}><div className="history-status"><ShieldCheck size={17}/></div><div className="history-main"><strong>{item.toolName}</strong><span>{storedFileNames(item.inputFileNames)} · {item.totalRecords.toLocaleString()} records · {item.outputFilename}</span></div><time>{new Date(item.completedAt).toLocaleString()}</time></article>)}</div>}</>}</CardContent></Card>
    </section>

    <section className="profile-settings-privacy"><ShieldCheck size={19}/><div><strong>Your workbook privacy is unchanged</strong><p>This page uses only your protected account settings and process metadata. It never displays or stores uploaded Excel files, worksheet content, previews, or generated workbook bytes.</p></div></section>
  </main>;
}
