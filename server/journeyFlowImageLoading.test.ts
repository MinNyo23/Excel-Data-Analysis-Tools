import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("journey-flow image loading experience", () => {
  it("shows an accessible skeleton before the image fades in after loading", () => {
    const component = projectFile("client/src/components/JourneyFlowImage.tsx");
    const styles = projectFile("client/src/privacy-diagram.css");

    expect(component).toContain('role="status"');
    expect(component).toContain("Loading end-user journey flow");
    expect(component).toContain("journey-flow-skeleton");
    expect(component).toContain("onLoad={() => setIsLoaded(true)}");
    expect(component).toContain("onError={() => setHasError(true)}");
    expect(component).toContain('role="alert"');
    expect(styles).toContain(".journey-flow-media.is-loaded img");
    expect(styles).toContain("opacity: 1");
    expect(styles).toContain("journey-flow-shimmer");
  });

  it("uses a short fade and respects reduced-motion preferences", () => {
    const styles = projectFile("client/src/privacy-diagram.css");

    expect(styles).toContain("transition: opacity 260ms");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("animation: none");
  });
});
