import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { supabase } from "./lib/supabase";
import { PROCESSING_API_BASE_URL } from "./lib/processingApi";
import { getLoginPathForCurrentLocation } from "./lib/loginNavigation";
import { getFriendlyApiMessage, isPassiveCurrentUserQuery, isUnauthenticatedApiError, reportRateLimitIfPresent } from "./lib/apiFeedback";
import { RateLimitFeedback, RateLimitFeedbackProvider } from "./components/RateLimitFeedback";
import { toast } from "sonner";
import "./index.css";

const queryClient = new QueryClient();

// A Supabase session can change without a full-page reload (for example when
// one person signs out and another signs in in the same browser tab). Never
// let user-scoped query results or transient workspace state cross that boundary.
let activeSupabaseUserId: string | null | undefined;
const clearTransientWorkspaceState = () => {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key && key !== "manus-cookie") sessionStorage.removeItem(key);
    }
  } catch {
    // Browser storage may be unavailable in private or embedded contexts.
  }
};

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => {
    activeSupabaseUserId = data.session?.user.id ?? null;
  });

  supabase.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user.id ?? null;
    const userChanged = activeSupabaseUserId !== undefined && activeSupabaseUserId !== nextUserId;
    activeSupabaseUserId = nextUserId;

    if (!userChanged && event !== "SIGNED_OUT" && event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED") return;
    clearTransientWorkspaceState();
    if (userChanged || event === "SIGNED_OUT") queryClient.clear();
    // The magic-link callback updates Supabase Auth, but the app identity comes
    // from the tRPC auth.me query. Refetch active queries after the session is
    // available so Login can transition into the protected workspace.
    if (session) void queryClient.refetchQueries({ type: "active" });
  });
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  if (window.location.pathname !== "/login") window.location.replace(getLoginPathForCurrentLocation());
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    // The unauthenticated account query establishes the signed-out UI. It is
    // expected before a user signs in and should not cover the Tool Overview.
    if (isUnauthenticatedApiError(error) || isPassiveCurrentUserQuery(event.query.queryKey)) return;
    const retryAfterSeconds = reportRateLimitIfPresent(error);
    toast.error(retryAfterSeconds ? "Requests are temporarily paused. See the countdown before trying again." : getFriendlyApiMessage(error, "We could not load this information. Please try again."));
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    reportRateLimitIfPresent(error);
    console.error("[API Mutation Error]", error);
  }
});

// In production, use the configured processor whenever it exists. The prior
// feature-flag-only check caused deployed builds to fall back to /api/trpc when
// the flag was omitted or serialized differently by the hosting environment.
const processingApiUrl = PROCESSING_API_BASE_URL ?? "";

const makeHttpLink = (baseUrl: string) => httpBatchLink({
  url: `${baseUrl}/api/trpc`,
  transformer: superjson,
  async headers() {
    const supabaseSession = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (supabaseSession.data.session?.access_token) return { Authorization: `Bearer ${supabaseSession.data.session.access_token}` };
    try {
      const raw = sessionStorage.getItem("manus-cookie");
      if (raw) {
        const prefix = `${COOKIE_NAME}=`;
        const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
        const token = pair?.trim().slice(prefix.length);
        if (token) return { Authorization: `Bearer ${token}` };
      }
    } catch {
      // sessionStorage unavailable
    }
    return {};
  },
  fetch(input, init) {
    return globalThis.fetch(input, { ...(init ?? {}), credentials: baseUrl ? "omit" : "include" });
  },
});

const trpcClient = trpc.createClient({
  links: [splitLink({
    condition: operation => operation.path[0] === "excel",
    true: makeHttpLink(processingApiUrl),
    false: makeHttpLink(""),
  })],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <RateLimitFeedbackProvider>
        <RateLimitFeedback />
        <App />
      </RateLimitFeedbackProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
