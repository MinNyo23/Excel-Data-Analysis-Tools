import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { sdk } from "./sdk";
import type { ApplicationUser } from "../supabaseIntegration";

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
    const legacyUser = await sdk.authenticateRequest(opts.req);
    user = legacyUser ? { ...legacyUser, authProvider: "manus" } : null;
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
