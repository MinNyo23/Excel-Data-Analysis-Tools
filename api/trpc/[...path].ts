import { createClient } from "@supabase/supabase-js";
import { isEmailAllowedForDomain } from "../../shared/authPolicy.js";
import { metadataStore } from "../../server/metadataStore.js";
import { supabaseGetAllowedEmailDomain, supabaseListProcessHistory } from "../../server/supabaseIntegration.js";

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

function trpcResult(json: unknown) {
  return { result: { data: { json } } };
}

function trpcError(message: string, code = "UNAUTHORIZED") {
  return {
    error: {
      message,
      data: { code, httpStatus: code === "UNAUTHORIZED" ? 401 : 500 },
    },
  };
}

async function getUser(req: any) {
  const authorization = header(req, "authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  const allowedDomain = await supabaseGetAllowedEmailDomain();
  if (!isEmailAllowedForDomain(data.user.email, allowedDomain)) return null;
  const metadata = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    openId: data.user.id,
    name: typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null,
    email: data.user.email ?? null,
    role: "user" as const,
    authProvider: "supabase" as const,
  };
}

async function resolveProcedure(name: string, user: Awaited<ReturnType<typeof getUser>>) {
  if (name === "auth.emailPolicy") return supabaseGetAllowedEmailDomain();
  if (name === "auth.me") return user;
  if (!user) return trpcError("Unauthorized", "UNAUTHORIZED");
  if (name === "profile.me") {
    return {
      identity: { name: user.name ?? "", email: user.email ?? "" },
      profile: await metadataStore.getProfile(user.id),
    };
  }
  if (name === "processHistory.list") return await supabaseListProcessHistory(user.id);
  return trpcError(`Unknown procedure: ${name}`, "NOT_FOUND");
}

async function handleCoreProcedures(req: any, res: any, procedures: string[]) {
  setApiHeaders(res, header(req, "origin"));
  if (req?.method === "OPTIONS") return res.status(204).end();
  const user = await getUser(req);
  const results = [];
  for (const procedure of procedures) {
    try {
      results.push(trpcResult(await resolveProcedure(procedure, user)));
    } catch (error) {
      console.error(`[Vercel tRPC] ${procedure} failed`, error);
      results.push(trpcError("Internal server error", "INTERNAL_SERVER_ERROR"));
    }
  }
  return res.status(200).json(results);
}

export default async function handler(req: any, res: any) {
  const path = String(req?.url ?? "").split("?", 1)[0];
  const procedurePath = path.split("/api/trpc/")[1] ?? "";
  const procedures = procedurePath.split(",").filter(Boolean);
  if (procedures.length > 0 && procedures.every(name => ["auth.emailPolicy", "auth.me", "profile.me", "processHistory.list"].includes(name))) {
    return handleCoreProcedures(req, res, procedures);
  }

  const { default: app } = await import("../index.js");
  return app(req, res);
}
