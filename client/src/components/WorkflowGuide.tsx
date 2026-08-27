import { Download, FileCheck2, FileUp, ShieldCheck } from "lucide-react";

export type WorkflowGuideContent = {
  title: string;
  purpose: string;
  upload: string;
  process: string;
  output: string;
};

export function WorkflowGuide({ title, purpose, upload, process, output }: WorkflowGuideContent) {
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
      <p className="workflow-guide-privacy"><ShieldCheck size={15} /> Your selected files are processed temporarily in memory. Workbook contents and downloaded files are not saved in the application database.</p>
    </aside>
  );
}
