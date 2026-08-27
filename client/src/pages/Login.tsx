import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startLogin } from "@/const";
import { getSafeReturnPath } from "@shared/loginPaths";
import { KeyRound, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { takeLoginReturnPath, saveLoginReturnPath } from "@/lib/loginNavigation";
import { usesSupabaseAuth } from "@/lib/supabase";
import "./Login.css";

const RESEND_COOLDOWN_SECONDS = 60;

function getReturnPathFromLocation() {
  if (typeof window === "undefined") return "/";
  const requested = new URLSearchParams(window.location.search).get("returnTo");
  return requested ? getSafeReturnPath(requested) : takeLoginReturnPath();
}

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const returnPath = useMemo(getReturnPathFromLocation, []);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) setLocation(returnPath);
  }, [isAuthenticated, loading, returnPath, setLocation]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (usesSupabaseAuth && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid work email address to receive your secure sign-in link.");
      return;
    }
    setIsSending(true);
    try {
      saveLoginReturnPath(returnPath);
      await startLogin(normalizedEmail || undefined);
      if (usesSupabaseAuth) {
        setMessage("A secure sign-in link has been sent. Check your email, then return to this browser to continue.");
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      setError("We could not start secure sign-in. Please wait a moment and try again.");
    } finally {
      setIsSending(false);
    }
  }

  return <main className="login-page">
    <section className="login-brand-panel" aria-label="Secure workspace information">
      <a className="login-brand" href="/login"><span><Sparkles size={19}/></span><div><small>OPERATIONS TOOLKIT</small><strong>Excel Master File</strong></div></a>
      <div className="login-brand-copy"><p className="login-eyebrow">SECURE WORKSPACE ACCESS</p><h1>Sign in to work with<br/><em>protected Excel tools.</em></h1><p>Use a passwordless email link to reach your private workspace, profile settings, and process-history metadata.</p></div>
      <div className="login-assurances"><div><ShieldCheck size={18}/><span><strong>No application password</strong><small>Your password is never requested or stored here.</small></span></div><div><Mail size={18}/><span><strong>Verified email link</strong><small>Your sign-in provider confirms access through your inbox.</small></span></div><div><KeyRound size={18}/><span><strong>Private processing history</strong><small>Only your own metadata is visible after sign-in.</small></span></div></div>
    </section>
    <section className="login-form-panel">
      <div className="login-card">
        <div className="login-card-icon"><ShieldCheck size={23}/></div>
        <p className="login-eyebrow">WELCOME BACK</p>
        <h2>Sign in securely</h2>
        <p className="login-description">We will send a one-time sign-in link to your work email. No password is collected by this application.</p>
        <form onSubmit={submit} noValidate>
          {usesSupabaseAuth && <label className="login-field"><span>Work email address</span><div><Mail size={17}/><Input type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" disabled={isSending || cooldown > 0}/></div></label>}
          {error && <p className="login-feedback login-error" role="alert">{error}</p>}
          {message && <p className="login-feedback login-success" role="status">{message}</p>}
          <Button type="submit" className="login-submit" disabled={isSending || cooldown > 0}>{isSending ? <><Loader2 className="animate-spin" size={17}/> Sending secure link…</> : cooldown > 0 ? `You can resend in ${cooldown}s` : <><Mail size={17}/>{usesSupabaseAuth ? "Email me a secure sign-in link" : "Continue with secure sign-in"}</>}</Button>
        </form>
        <div className="login-privacy-note"><ShieldCheck size={15}/><p><strong>What is saved:</strong> your provider-managed identity and limited account metadata. <strong>What is not saved:</strong> passwords, uploaded workbooks, worksheets, previews, or output files.</p></div>
        <p className="login-terms">By continuing, you agree to use the workspace responsibly. Terms &amp; Conditions are available after sign-in.</p>
      </div>
    </section>
  </main>;
}
