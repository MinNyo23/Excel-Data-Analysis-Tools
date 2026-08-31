import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function setApiHeaders(res: Response, origin?: string) {
  if (origin === "https://excel-master-file-tool.vercel.app" || origin?.endsWith(".vercel.app")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-trpc-source");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
}

function trpcResponse(user: { id: string; openId: string; name: string | null; email: string | null; role: "user"; authProvider: "supabase" } | null) {
  return [{ result: { data: { json: user } } }];
}

async function handleAuthMe(req: Request, res: Response) {
  setApiHeaders(res, req.header("origin"));
  if (req.method === "OPTIONS") return res.status(204).end();

  const authorization = req.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !supabase) return res.status(200).json(trpcResponse(null));

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(200).json(trpcResponse(null));

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

export default async function handler(req: Request, res: Response) {
  const path = (req.url ?? "").split("?", 1)[0];
  if (path.endsWith("/auth.me")) return handleAuthMe(req, res);

  const { default: app } = await import("../index");
  return app(req, res);
}
