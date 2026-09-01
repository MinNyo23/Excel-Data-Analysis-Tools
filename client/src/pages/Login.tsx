import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startLogin } from "@/const";
import { getSafeReturnPath } from "@shared/loginPaths";
import { KeyRound, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { takeLoginReturnPath, saveLoginReturnPath } from "@/lib/loginNavigation";
import "./Login.css";

const RECAPTCHA_SITE_KEY = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined)?.trim() || "";

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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<ReCAPTCHA | null>(null);
  const captchaRequired = Boolean(RECAPTCHA_SITE_KEY);

  useEffect(() => {
    if (!loading && isAuthenticated) setLocation(returnPath);
  }, [isAuthenticated, loading, returnPath, setLocation]);

  function resetCaptcha() {
    setCaptchaToken(null);
    captchaRef.current?.reset();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (captchaRequired && !captchaToken) {
      setError("Please complete the CAPTCHA check before continuing.");
      return;
    }
    setIsSending(true);
    try {
      saveLoginReturnPath(returnPath);
      await startLogin(email.trim().toLowerCase() || undefined, captchaToken ?? undefined, returnPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not start secure sign-in. Please try again.");
      resetCaptcha();
    } finally {
      setIsSending(false);
    }
  }

  return <main className="login-page">
    <section className="login-brand-panel" aria-label="Secure workspace information">
      <a className="login-brand" href="/login"><span><Sparkles size={19}/></span><div><small>OPERATIONS TOOLKIT</small><strong>Excel Master File</strong></div></a>
      <div className="login-brand-copy"><p className="login-eyebrow">SECURE WORKSPACE ACCESS</p><h1>Sign in to work with<br/><em>protected Excel tools.</em></h1><p>Use a secure sign-in link to reach your private workspace, profile settings, and process-history metadata.</p></div>
      <div className="login-assurances"><div><ShieldCheck size={18}/><span><strong>No application password</strong><small>Your password is never requested or stored here.</small></span></div><div><Mail size={18}/><span><strong>Verified email sign-in</strong><small>Your sign-in provider confirms access securely.</small></span></div><div><KeyRound size={18}/><span><strong>Private processing history</strong><small>Only your own metadata is visible after sign-in.</small></span></div></div>
    </section>
    <section className="login-form-panel">
      <div className="login-card">
        <div className="login-card-icon"><ShieldCheck size={23}/></div>
        <p className="login-eyebrow">WELCOME BACK</p>
        <h2>Sign in securely</h2>
        <p className="login-description">Continue with the application’s secure sign-in provider. No password is collected by this application.</p>
        <form onSubmit={submit} noValidate>
          <label className="login-field"><span>Work email address</span><div><Mail size={17}/><Input type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" disabled={isSending}/></div></label>
          {captchaRequired && <div className="login-captcha" aria-label="Spam protection"><ReCAPTCHA ref={captchaRef} sitekey={RECAPTCHA_SITE_KEY} onChange={token => setCaptchaToken(token)} onExpired={() => setCaptchaToken(null)} onErrored={() => { setCaptchaToken(null); setError("CAPTCHA could not be verified. Check your Google reCAPTCHA key and domain."); }} /></div>}
          {error && <p className="login-feedback login-error" role="alert">{error}</p>}
          {message && <p className="login-feedback login-success" role="status">{message}</p>}
          <Button type="submit" className="login-submit" disabled={isSending || (captchaRequired && !captchaToken)}>{isSending ? <><Loader2 className="animate-spin" size={17}/> Opening secure sign-in…</> : <><Mail size={17}/> Continue with secure sign-in</>}</Button>
        </form>
        <div className="login-privacy-note"><ShieldCheck size={15}/><p><strong>What is saved:</strong> your provider-managed identity and limited account metadata. <strong>What is not saved:</strong> passwords, uploaded workbooks, worksheets, previews, or output files.</p></div>
        <p className="login-terms">By continuing, you agree to use the workspace responsibly. <a href="/terms">View Terms &amp; Conditions</a></p>
      </div>
    </section>
  </main>;
}
