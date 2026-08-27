import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("footer and terms contract", () => {
  it("shows the requested developer credit and an accessible Terms and Conditions link in the shared footer", () => {
    const footer = readFileSync(path.resolve(process.cwd(), "client/src/components/AppFooter.tsx"), "utf8");
    const layout = readFileSync(path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

    expect(footer).toContain("Developed by <strong>Min Nyo</strong>");
    expect(footer).toContain('href="/terms"');
    expect(footer).toContain("Terms &amp; Conditions");
    expect(layout).toContain("<AppFooter />");
  });

  it("registers terms content that explains the in-memory file boundary and acceptable use", () => {
    const app = readFileSync(path.resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    const terms = readFileSync(path.resolve(process.cwd(), "client/src/pages/TermsConditions.tsx"), "utf8");

    expect(app).toContain('<Route path={"/terms"} component={TermsConditions} />');
    expect(terms).toContain("does not intentionally store uploaded workbooks");
    expect(terms).toContain("Acceptable use");
    expect(terms).toContain("not legal advice");
  });

  it("uses a professional footer background with smooth accessible link interactions", () => {
    const styles = readFileSync(path.resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(styles).toContain(".application-footer{display:flex");
    expect(styles).toContain("background:linear-gradient(100deg,#edf5ec");
    expect(styles).toContain(".application-footer-link:hover");
    expect(styles).toContain(".application-footer-link:focus-visible");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
  });
});
