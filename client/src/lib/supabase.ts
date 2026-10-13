import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.SUPABASE_ANON_KEY
) as string | undefined;
const enabled = import.meta.env.VITE_USE_SUPABASE_AUTH !== "false" && Boolean(url && publishableKey);

export const supabase = enabled && url && publishableKey
  ? createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const usesSupabaseAuth = enabled && Boolean(supabase);
