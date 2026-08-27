import { supabase, usesSupabaseAuth } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // Login is started via startLogin() in the effect below, only when we actually
  // navigate — never during render. startLogin() mints a one-time nonce + writes
  // the state cookie, so calling it per render would overwrite the cookie and
  // desync it from an in-flight login's `state`.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    let clearedProcessHistory = 0;
    let pendingError: unknown;
    try {
      const result = await logoutMutation.mutateAsync() as { clearedProcessHistory?: number };
      clearedProcessHistory = typeof result.clearedProcessHistory === "number" ? result.clearedProcessHistory : 0;
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        clearedProcessHistory = 0;
      } else {
        pendingError = error;
      }
    } finally {
      try { if (usesSupabaseAuth && supabase) await supabase.auth.signOut(); } catch (error) { pendingError ??= error; }
      // Clear application-created session and cached request data. Workbook
      // bytes and output rows are transient React state and are discarded when
      // the protected workspace unmounts after navigation to /login.
      try {
        sessionStorage.clear();
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (key?.startsWith("excel-master-file-") || key?.startsWith("sb-")) localStorage.removeItem(key);
        }
      } catch {}
      queryClient.clear();
      utils.auth.me.setData(undefined, null);
    }
    if (pendingError) throw pendingError;
    return { success: true, clearedProcessHistory } as const;
  }, [logoutMutation, queryClient, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    // Navigate only after the auth state is established.
    if (redirectPath) {
      window.location.href = redirectPath;
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
