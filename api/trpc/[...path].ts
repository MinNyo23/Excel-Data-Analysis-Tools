import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const supabase: any = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function header(req: any, name: string) {
  const value = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function setApiHeaders(res: any, origin?: string) {
  if (origin === "https://excel-master-file-tool.vercel.app" || origin?.endsWith(".vercel.app")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-trpc-source");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
}

function trpcResponse(user: unknown) {
  return [{ result: { data: { json: user } } }];
}

async function handleAuthMe(req: any, res: any) {
  setApiHeaders(res, header(req, "origin"));
  if (req?.method === "OPTIONS") return res.status(204).end();

  const authorization = header(req, "authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !supabase) return res.status(200).json(trpcResponse(null));

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(200).json(trpcResponse(null));

  const metadata = data.user.user_metadata ?? {};
  return res.status(200).json(trpcResponse({
    id: data.user.id,
    openId: data.user.id,
    name: typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null,
    email: data.user.email ?? null,
    role: "user",
    authProvider: "supabase",
  }));
}

export default async function handler(req: any, res: any) {
  const path = String(req?.url ?? "").split("?", 1)[0];
  if (path.endsWith("/auth.me")) return handleAuthMe(req, res);

  const { default: app } = await import("../index");
  return app(req, res);
}
