import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("rate-limit feedback UI contract", () => {
  it("mounts a shared countdown notice and locks process buttons while a retry window is active", () => {
    const root = process.cwd();
    const bootstrap = readFileSync(path.resolve(root, "client/src/main.tsx"), "utf8");
    const feedback = readFileSync(path.resolve(root, "client/src/components/RateLimitFeedback.tsx"), "utf8");
    const styles = readFileSync(path.resolve(root, "client/src/index.css"), "utf8");

    expect(bootstrap).toContain("RateLimitFeedbackProvider");
    expect(bootstrap).toContain("reportRateLimitIfPresent(error)");
    expect(feedback).toContain("Requests temporarily paused");
    expect(feedback).toContain("Retry in");
    expect(feedback).toContain("rateLimited");
    expect(styles).toContain('html[data-rate-limited="true"] .process-button');
  });
});
