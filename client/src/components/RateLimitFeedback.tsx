import { Clock3, ShieldAlert } from "lucide-react";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { rateLimitEventName } from "@/lib/apiFeedback";

type RateLimitState = { isRateLimited: boolean; remainingSeconds: number };
const RateLimitContext = createContext<RateLimitState>({ isRateLimited: false, remainingSeconds: 0 });

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function RateLimitFeedbackProvider({ children }: { children: ReactNode }) {
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onRateLimit = (event: Event) => {
      const seconds = Number((event as CustomEvent<{ retryAfterSeconds?: unknown }>).detail?.retryAfterSeconds);
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      setRetryUntil(current => Math.max(current, Date.now() + Math.min(600, Math.ceil(seconds)) * 1000));
      setNow(Date.now());
    };
    window.addEventListener(rateLimitEventName(), onRateLimit);
    return () => window.removeEventListener(rateLimitEventName(), onRateLimit);
  }, []);

  useEffect(() => {
    if (retryUntil <= now) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [now, retryUntil]);

  const remainingSeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const value = useMemo(() => ({ isRateLimited: remainingSeconds > 0, remainingSeconds }), [remainingSeconds]);

  useEffect(() => {
    document.documentElement.dataset.rateLimited = value.isRateLimited ? "true" : "false";
    return () => { delete document.documentElement.dataset.rateLimited; };
  }, [value.isRateLimited]);

  return <RateLimitContext.Provider value={value}>{children}</RateLimitContext.Provider>;
}

export function useRateLimitCountdown() {
  return useContext(RateLimitContext);
}

export function RateLimitFeedback() {
  const { isRateLimited, remainingSeconds } = useRateLimitCountdown();
  if (!isRateLimited) return null;
  return <aside className="rate-limit-feedback" role="status" aria-live="polite" aria-atomic="true"><ShieldAlert size={20}/><div><strong>Requests temporarily paused</strong><p>To protect the service, please wait before running another action. Retry in <span><Clock3 size={14}/>{formatCountdown(remainingSeconds)}</span></p></div></aside>;
}
