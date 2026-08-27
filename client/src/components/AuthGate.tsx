import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginPathForCurrentLocation, takeLoginReturnPath } from "@/lib/loginNavigation";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && location === "/") {
      const returnPath = takeLoginReturnPath();
      if (returnPath !== "/") setLocation(returnPath);
    }
  }, [isAuthenticated, loading, location, setLocation]);

  if (loading) return <main className="auth-gate-loading" aria-live="polite"><Loader2 className="animate-spin" size={22}/><span>Checking your secure session…</span></main>;
  if (!isAuthenticated) return <Redirect to={getLoginPathForCurrentLocation()} />;
  return <>{children}</>;
}
