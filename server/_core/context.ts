import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { sdk } from "./sdk.js";
import { authenticateSupabaseRequest, usesSupabaseServerAuth, type ApplicationUser } from "../supabaseIntegration.js";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: ApplicationUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: ApplicationUser | null = null;

  try {
    user = await authenticateSupabaseRequest(opts.req);
    // Supabase is the active production auth provider. Do not initialize or
    // call the legacy OAuth SDK when its server credentials are configured;
    // that SDK requires OAUTH_SERVER_URL and is not used by this deployment.
    if (!user && !usesSupabaseServerAuth) {
      const legacyUser = await sdk.authenticateRequest(opts.req);
      user = legacyUser ? { ...legacyUser, authProvider: "manus" } : null;
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
