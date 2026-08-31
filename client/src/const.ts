import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";
import { supabase, usesSupabaseAuth } from "./lib/supabase";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startLogin = async (email?: string, captchaToken?: string, returnPath = "/") => {
  if (usesSupabaseAuth && supabase) {
    if (!email) throw new Error("An email address is required for passwordless sign-in.");
    if (!captchaToken) throw new Error("CAPTCHA verification is required.");
    // Let Supabase perform its configured CAPTCHA verification. Google tokens
    // are single-use, so verifying them in a separate endpoint first causes
    // Supabase to reject the same token with invalid-input-response.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Always return to the exact public login route. Keeping query parameters
        // out of the Supabase redirect target avoids redirect-allowlist mismatches;
        // the requested workspace path is already stored locally before sending.
        emailRedirectTo: `${window.location.origin}/login`,
        captchaToken,
      },
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("captcha")) throw new Error("CAPTCHA verification failed. Please complete the check again.");
      if (error.status === 429 || message.includes("rate") || message.includes("too many")) {
        throw new Error("Too many sign-in attempts. Please wait a moment and try again.");
      }
      throw new Error("We could not start secure sign-in. Please wait a moment and try again.");
    }
    return;
  }
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};
