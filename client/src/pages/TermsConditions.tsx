import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileLock2, ShieldCheck, Scale, UserCheck } from "lucide-react";

const effectiveDate = "27 August 2026";

export default function TermsConditions() {
  return <main className="terms-page container">
    <section className="terms-hero">
      <Badge className="soft-badge">SERVICE TERMS</Badge>
      <h1>Terms &amp; <em>Conditions</em></h1>
      <p>These terms explain the permitted use of Excel Master File Tool and the privacy boundaries for your workbook processing.</p>
      <span>Effective date: {effectiveDate}</span>
    </section>

    <Card className="terms-notice"><CardContent><Scale size={20}/><div><strong>Working terms — review before relying on them commercially</strong><p>These are general service terms, not legal advice. Please have a qualified lawyer review them before using them as binding terms for a business or regulated service.</p></div></CardContent></Card>

    <section className="terms-grid" aria-label="Terms and conditions">
      <article><span><FileLock2 size={18}/></span><h2>1. Service and files</h2><p>The tool helps you transform compatible CSV and XLSX workbooks into a preview and downloadable output. Files are processed temporarily in memory for the requested workflow; the application does not intentionally store uploaded workbooks, worksheet cells, previews, or generated workbook bytes in its database or file storage.</p></article>
      <article><span><UserCheck size={18}/></span><h2>2. Your responsibilities</h2><p>You are responsible for ensuring that you have permission to upload and process every workbook. Do not upload unlawful, harmful, malicious, or confidential data unless you are authorized to handle it and have assessed whether the service is suitable for that data.</p></article>
      <article><span><ShieldCheck size={18}/></span><h2>3. Accounts and privacy</h2><p>Account features are available only to the signed-in user. Editable profile values are encrypted before storage. Completed-process history contains limited metadata only, such as tool name, source filename metadata, totals, output filename, and time; you can manage retention, export your account data, or clear history from the account pages.</p></article>
      <article><span><FileLock2 size={18}/></span><h2>4. Acceptable use</h2><p>You must not attempt to bypass security controls, overload the service, probe other users’ data, reverse engineer protected services, or use the tool to distribute harmful content. Temporary request limits protect the service; when a limit is reached, wait for the displayed countdown before trying again.</p></article>
      <article><span><Scale size={18}/></span><h2>5. Output review and availability</h2><p>You must review each preview and downloaded workbook before relying on it for payroll, compliance, reporting, or any other consequential purpose. The service is provided as available and may change, pause, or be updated to protect reliability and security.</p></article>
      <article><span><UserCheck size={18}/></span><h2>6. Updates to these terms</h2><p>Material updates will be published on this page with a revised effective date. Continuing to use the tool after an update means you accept the revised terms to the extent permitted by applicable law.</p></article>
    </section>
  </main>;
}
