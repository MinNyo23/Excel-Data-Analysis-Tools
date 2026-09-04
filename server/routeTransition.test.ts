import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("route transition contract", () => {
  it("keys a shared route transition to the current location and waits for the outgoing page", () => {
    const transition = readFileSync(path.resolve(process.cwd(), "client/src/components/RouteTransition.tsx"), "utf8");

    expect(transition).toContain('import { AnimatePresence, motion, useReducedMotion } from "framer-motion"');
    expect(transition).toContain("const [location] = useLocation()");
    expect(transition).toContain('<AnimatePresence initial={false} mode="wait">');
    expect(transition).toContain("key={location}");
    expect(transition).toContain("duration: reduceMotion ? 0 : 0.22");
  });

  it("wraps the router once while preventing signed-out routes from rendering workspace navigation chrome", () => {
    const app = readFileSync(path.resolve(process.cwd(), "client/src/App.tsx"), "utf8");

    expect(app).toContain('import RouteTransition from "./components/RouteTransition"');
    expect(app).toContain("const routedContent = <RouteTransition><Router /></RouteTransition>;");
    expect(app).toContain('if (location.startsWith("/login") || loading || !isAuthenticated) return routedContent;');
    expect(app).toContain("return <DashboardLayout key={user?.id ?? \"authenticated-workspace\"}>{routedContent}</DashboardLayout>;");
  });
});
