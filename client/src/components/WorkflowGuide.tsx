import { Download, FileCheck2, FileSpreadsheet, FileUp, ShieldCheck } from "lucide-react";

export type WorkflowSampleTemplate = {
  label: string;
  format: "CSV" | "XLSX";
  filename: string;
  href: string;
};

export type WorkflowGuideContent = {
  title: string;
  purpose: string;
  upload: string;
  process: string;
  output: string;
  templates: WorkflowSampleTemplate[];
};

type WorkflowGuideProps = WorkflowGuideContent & {
  onDownloadTemplate: (template: WorkflowSampleTemplate) => void;
};

export function WorkflowGuide({ title, purpose, upload, process, output, templates, onDownloadTemplate }: WorkflowGuideProps) {
  return (
    <aside className="workflow-guide" aria-labelledby="workflow-guide-title">
      <div className="workflow-guide-intro">
        <span>HOW TO USE THIS TOOL</span>
        <h2 id="workflow-guide-title">{title}</h2>
        <p>{purpose}</p>
      </div>
      <div className="workflow-guide-steps">
        <article>
          <span className="workflow-guide-icon"><FileUp size={17} /></span>
          <div><strong>1. Upload</strong><p>{upload}</p></div>
        </article>
        <article>
          <span className="workflow-guide-icon"><FileCheck2 size={17} /></span>
          <div><strong>2. Process</strong><p>{process}</p></div>
        </article>
        <article>
          <span className="workflow-guide-icon"><Download size={17} /></span>
          <div><strong>3. Review and download</strong><p>{output}</p></div>
        </article>
      </div>
      <section className="workflow-guide-templates" aria-label={`${title} sample templates`}>
        <div className="workflow-guide-templates-heading">
          <span><FileSpreadsheet size={15} /> SAMPLE FILES</span>
          <p>Download a privacy-safe example with the expected columns, then upload it to try this workflow.</p>
        </div>
        <div className="workflow-guide-template-grid">
          {templates.map(template => <button key={template.href} type="button" className="workflow-guide-template" onClick={() => onDownloadTemplate(template)}>
            <span className="workflow-guide-template-format">{template.format}</span>
            <span className="workflow-guide-template-label">{template.label}</span>
            <Download size={15} aria-hidden="true" />
          </button>)}
        </div>
      </section>
      <p className="workflow-guide-privacy"><ShieldCheck size={15} /> Your selected files are processed temporarily in memory. Workbook contents and downloaded files are not saved in the application database.</p>
    </aside>
  );
}
