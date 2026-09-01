import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { startLogin } from "@/const";
import { getSafeReturnPath } from "@shared/loginPaths";
import { KeyRound, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { takeLoginReturnPath, saveLoginReturnPath } from "@/lib/loginNavigation";
import { supabase, usesSupabaseAuth } from "@/lib/supabase";
import "./Login.css";

const RESEND_COOLDOWN_SECONDS = 60;
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
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<ReCAPTCHA | null>(null);
  const captchaRequired = Boolean(RECAPTCHA_SITE_KEY);

  useEffect(() => {
    if (!loading && isAuthenticated) setLocation(returnPath);
  }, [isAuthenticated, loading, returnPath, setLocation]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function resetCaptcha() {
    setCaptchaToken(null);
    captchaRef.current?.reset();
  }

  async function requestOtp(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid work email address to receive your one-time password.");
      return;
    }
    if (captchaRequired && !captchaToken) {
      setError("Please complete the CAPTCHA check before requesting a code.");
      return;
    }
    setIsBusy(true);
    try {
      saveLoginReturnPath(returnPath);
      if (usesSupabaseAuth && supabase) {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: true, captchaToken: captchaToken ?? undefined },
        });
        if (authError) throw authError;
        setOtpSent(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setMessage(`We sent an eight-digit code to ${normalizedEmail}. The code expires soon.`);
        resetCaptcha();
      } else {
        await startLogin(normalizedEmail, captchaToken ?? undefined, returnPath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send your one-time password. Please try again.");
      resetCaptcha();
    } finally {
      setIsBusy(false);
    }
  }

  async function verifyOtp(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\d{8}$/.test(otp)) {
      setError("Enter the eight-digit code from your email.");
      return;
    }
    if (!supabase) return;
    setIsBusy(true);
    try {
      const { error: authError } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: otp, type: "email" });
      if (authError) throw authError;
      setMessage("Verified. Opening your private workspace…");
      setLocation(returnPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code is invalid or expired. Request a new code and try again.");
    } finally {
      setIsBusy(false);
    }
  }

  return <main className="login-page">
    <section className="login-brand-panel" aria-label="Secure workspace information">
      <a className="login-brand" href="/login"><span><Sparkles size={19}/></span><div><small>OPERATIONS TOOLKIT</small><strong>Excel Master File</strong></div></a>
      <div className="login-brand-copy"><p className="login-eyebrow">SECURE WORKSPACE ACCESS</p><h1>Sign in to work with<br/><em>protected Excel tools.</em></h1><p>Use a one-time password to reach your private workspace, profile settings, and process-history metadata.</p></div>
      <div className="login-assurances"><div><ShieldCheck size={18}/><span><strong>No application password</strong><small>Your password is never requested or stored here.</small></span></div><div><Mail size={18}/><span><strong>Verified email code</strong><small>Your sign-in code is delivered to your inbox.</small></span></div><div><KeyRound size={18}/><span><strong>Private processing history</strong><small>Only your own metadata is visible after sign-in.</small></span></div></div>
    </section>
    <section className="login-form-panel">
      <div className="login-card">
        <div className="login-card-icon"><ShieldCheck size={23}/></div>
        <p className="login-eyebrow">WELCOME BACK</p>
        <h2>{otpSent ? "Enter your code" : "Sign in securely"}</h2>
        <p className="login-description">{otpSent ? "Enter the eight-digit one-time password sent to your email. It can only be used once." : "We will send an eight-digit one-time password to your work email. No password is collected by this application."}</p>
        {!otpSent ? <form onSubmit={requestOtp} noValidate>
          <label className="login-field"><span>Work email address</span><div><Mail size={17}/><Input type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" disabled={isBusy || cooldown > 0}/></div></label>
          {captchaRequired && <div className="login-captcha" aria-label="Spam protection"><ReCAPTCHA ref={captchaRef} sitekey={RECAPTCHA_SITE_KEY} onChange={token => setCaptchaToken(token)} onExpired={() => setCaptchaToken(null)} onErrored={() => { setCaptchaToken(null); setError("CAPTCHA could not be verified. Check your Google reCAPTCHA key and domain."); }} /></div>}
          {error && <p className="login-feedback login-error" role="alert">{error}</p>}
          <Button type="submit" className="login-submit" disabled={isBusy || cooldown > 0 || (captchaRequired && !captchaToken)}>{isBusy ? <><Loader2 className="animate-spin" size={17}/> Sending code…</> : cooldown > 0 ? `Code sent · wait ${cooldown}s` : <><Mail size={17}/> Email me a one-time password</>}</Button>
        </form> : <form onSubmit={verifyOtp} noValidate>
          <label className="login-field"><span>One-time password</span><InputOTP maxLength={8} value={otp} onChange={setOtp} autoFocus disabled={isBusy} aria-label="Eight-digit one-time password"><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/><InputOTPSlot index={4}/><InputOTPSlot index={5}/><InputOTPSlot index={6}/><InputOTPSlot index={7}/></InputOTPGroup></InputOTP></label>
          {error && <p className="login-feedback login-error" role="alert">{error}</p>}
          {message && <p className="login-feedback login-success" role="status">{message}</p>}
          <Button type="submit" className="login-submit" disabled={isBusy || otp.length !== 8}>{isBusy ? <><Loader2 className="animate-spin" size={17}/> Verifying…</> : "Verify and enter workspace"}</Button>
          <Button type="button" variant="outline" className="login-resend" onClick={() => { setOtpSent(false); setOtp(""); setMessage(null); setError(null); }} disabled={isBusy}>Use a different email</Button>
          <Button type="button" variant="outline" className="login-resend" onClick={() => void requestOtp()} disabled={isBusy || cooldown > 0}>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}</Button>
        </form>}
        <div className="login-privacy-note"><ShieldCheck size={15}/><p><strong>What is saved:</strong> your provider-managed identity and limited account metadata. <strong>What is not saved:</strong> passwords, uploaded workbooks, worksheets, previews, or output files.</p></div>
        <p className="login-terms">By continuing, you agree to use the workspace responsibly. Terms &amp; Conditions are available after sign-in.</p>
      </div>
    </section>
  </main>;
}
