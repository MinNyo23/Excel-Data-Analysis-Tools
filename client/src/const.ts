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
export const startLogin = async (email?: string, returnPath = "/") => {
  if (usesSupabaseAuth && supabase) {
    if (!email) throw new Error("An email address is required for passwordless sign-in.");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Use a dedicated callback route so the app can wait for Supabase to
        // finish the email-link session handoff before navigating to home.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      const message = error.message.toLowerCase();
          if (error.status === 429 || message.includes("rate") || message.includes("too many")) {
        throw new Error("Too many sign-in attempts. Please wait a moment and try again.");
      }
      if (message.includes("unregistered api key") || message.includes("invalid api key")) {
        throw new Error("Supabase authentication is using a key from the wrong project. Update the deployed Supabase publishable/anon key to match the configured Supabase URL, then redeploy.");
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
