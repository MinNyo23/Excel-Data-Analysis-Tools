import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLoginPath, getSafeReturnPath } from "../shared/loginPaths";
import { getSessionCookieOptions } from "./_core/cookies";

const project = process.cwd();
const source = (relativePath: string) => readFileSync(path.join(project, relativePath), "utf8");

describe("dedicated login security", () => {
  it("accepts only same-origin return paths and rejects open-redirect values", () => {
    expect(getSafeReturnPath("/tools/addition-exit?mode=review")).toBe("/tools/addition-exit?mode=review");
    expect(getSafeReturnPath("https://attacker.example")).toBe("/");
    expect(getSafeReturnPath("//attacker.example")).toBe("/");
    expect(getSafeReturnPath("/\\attacker.example")).toBe("/");
    expect(buildLoginPath("/profile")).toBe("/login?returnTo=%2Fprofile");
  });

  it("uses a passwordless email form, protects workspace routes, and does not retain custom user data in browser storage", () => {
    const login = source("client/src/pages/Login.tsx");
    const app = source("client/src/App.tsx");
    const authEntry = source("client/src/const.ts");
    const authHook = source("client/src/_core/hooks/useAuth.ts");
    const queryBootstrap = source("client/src/main.tsx");
    expect(login).toContain('type="email"');
    expect(login).not.toContain('type="password"');
    expect(login).toContain("No password is collected by this application.");
    expect(login).toContain("RESEND_COOLDOWN_SECONDS = 60");
    expect(app).toContain('<Route path={"/login"} component={Login} />');
    expect(app).toContain("<AuthGate><Home /></AuthGate>");
    expect(app).toContain('<Route path={"/"}><AuthGate><Home /></AuthGate></Route>');
    expect(authEntry).toContain("signInWithOtp");
    expect(authEntry).toContain("emailRedirectTo: window.location.origin");
    expect(authEntry).not.toContain("window.prompt");
    expect(authHook).not.toContain("manus-runtime-user-info");
    expect(queryBootstrap).toContain("getLoginPathForCurrentLocation");
    expect(source("client/src/components/AuthGate.tsx")).toContain("takeLoginReturnPath");
  });

  it("retains secure, HTTP-only same-site legacy session cookies", () => {
    const options = getSessionCookieOptions({ protocol: "https", headers: {} } as any);
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  });
});
