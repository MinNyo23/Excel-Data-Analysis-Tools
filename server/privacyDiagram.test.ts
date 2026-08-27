import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("in-app privacy journey diagram", () => {
  it("shows the supplied end-user journey flow with meaningful alternative text and reference copy", () => {
    const page = projectFile("client/src/pages/Home.tsx");
    expect(page).toContain('<details className="privacy-details" open>');
    expect(page).toContain('const JOURNEY_FLOW_IMAGE_URL = "https://3000-il1ewvzwfbgv4rg9wy6pi-abbe9b7d.us4.manus.computer/manus-storage/end-user-journey-flow_7a1b9923.webp"');
    expect(page).toContain("src={JOURNEY_FLOW_IMAGE_URL}");
    expect(page).toContain("Your journey from upload to download");
    expect(page).toContain("Open the full end-user journey flow");
    expect(page).toContain('alt="End-user journey flow: sign in, choose an Excel workflow');
    expect(page).toContain("workbook data is not saved to the application database");
  });

  it("allows only the managed journey-flow host for production image requests", () => {
    const vercelConfig = projectFile("vercel.json");

    expect(vercelConfig).toContain("img-src 'self' data: blob: https://3000-il1ewvzwfbgv4rg9wy6pi-abbe9b7d.us4.manus.computer");
  });

  it("keeps the portrait journey image centered and usable on small screens", () => {
    const styles = projectFile("client/src/privacy-diagram.css");
    expect(styles).toContain(".privacy-diagram-viewport");
    expect(styles).toContain("justify-content: center");
    expect(styles).toContain(".privacy-journey-diagram img");
    expect(styles).toContain("@media (max-width: 680px)");
  });
});
