import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import "./Login.css";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeEmailSignIn() {
      if (!supabase) {
        setError("Secure sign-in is not configured for this deployment.");
        return;
      }

      // Supabase automatically consumes the email-link hash or PKCE code because
      // detectSessionInUrl is enabled in the client. Waiting for getSession()
      // ensures that handoff has completed before the app calls its own API.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setError("Your sign-in link could not be verified. Please request a new link.");
        return;
      }

      // The backend validates this access token through the Authorization header.
      const result = await refresh();
      if (cancelled) return;

      if (result.error || !result.data) {
        setError("Your sign-in link could not be verified. Please request a new link.");
        return;
      }

      if (result.data) {
        window.history.replaceState({}, document.title, "/");
        setLocation("/");
      }
    }

    if (!loading && !isAuthenticated) void completeEmailSignIn();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loading, refresh, setLocation]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      window.history.replaceState({}, document.title, "/");
      setLocation("/");
    }
  }, [isAuthenticated, loading, setLocation]);

  return (
    <main className="login-page">
      <section className="login-form-panel">
        <div className="login-card" aria-live="polite">
          <div className="login-card-icon"><ShieldCheck size={23} /></div>
          <p className="login-eyebrow">SECURE SIGN-IN</p>
          <h2>{error ? "Sign-in link expired" : "Opening your workspace"}</h2>
          {error ? (
            <>
              <p className="login-description">{error}</p>
              <a className="login-submit" href="/login">Return to sign in</a>
            </>
          ) : (
            <p className="login-description"><Loader2 className="animate-spin" size={17} /> Verifying your email and opening the home page…</p>
          )}
        </div>
      </section>
    </main>
  );
}

