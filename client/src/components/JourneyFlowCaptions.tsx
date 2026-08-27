const JOURNEY_STEPS = [
  ["Sign in", "Use your account to access private profile settings and keep optional process metadata associated only with you."],
  ["Choose a workflow", "Select the Excel task that matches your goal, such as consolidating workbooks, checking records, or preparing an upload file."],
  ["Select valid files", "Choose CSV or XLSX files for the selected workflow. If a file is not accepted, read the message and choose a supported file."],
  ["Start processing", "Select the process button after your files are accepted. The tool uses the selected files only for the workflow you chose."],
  ["Process in memory", "Your workbook is processed securely in memory. Workbook contents, preview rows, and generated files are not saved to the application database."],
  ["Review the result", "Check the preview, totals, and any notices before downloading, so you can confirm the output is suitable for your work."],
  ["Download the workbook", "Save the finished XLSX file to your device. Your download remains under your control after the workflow is complete."],
] as const;

export function JourneyFlowCaptions() {
  return (
    <section className="journey-flow-captions" aria-labelledby="journey-flow-captions-title">
      <div className="journey-flow-captions-heading">
        <span>STEP GUIDE</span>
        <h3 id="journey-flow-captions-title">What each step means</h3>
      </div>
      <ol>
        {JOURNEY_STEPS.map(([title, description], index) => (
          <li key={title}>
            <span className="journey-flow-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
