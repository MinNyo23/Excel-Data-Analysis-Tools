import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '../../shared/const.js';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.js";
import { consumeRateLimit } from "../security.js";

type PublicErrorShape = {
  message: string;
  data: { code: string; httpStatus: number; [key: string]: unknown };
};

function retryAfterSecondsFromCause(cause: unknown) {
  if (!cause || typeof cause !== "object") return undefined;
  const retryAfterSeconds = (cause as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  return typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds)
    ? Math.max(1, Math.min(600, Math.ceil(retryAfterSeconds)))
    : undefined;
}

export function redactTRPCErrorShape(shape: PublicErrorShape, errorCode: string, cause?: unknown) {
  const publicMessage = errorCode === "INTERNAL_SERVER_ERROR"
    ? "Request could not be completed."
    : errorCode === "NOT_FOUND"
      ? "The requested API operation was not found."
      : errorCode === "BAD_REQUEST"
        ? "We could not use that request. Please check your selected file or settings and try again."
      : shape.message;
  const retryAfterSeconds = errorCode === "TOO_MANY_REQUESTS" ? retryAfterSecondsFromCause(cause) : undefined;
  return {
    ...shape,
    message: publicMessage,
    data: {
      code: shape.data.code,
      httpStatus: shape.data.httpStatus,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    },
  };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Do not expose internal stack traces, filesystem paths, procedure paths, or
    // validation implementation details in the browser-facing API response.
    return redactTRPCErrorShape(shape, error.code, error.cause) as typeof shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

function rateLimited(limit: number, windowMs: number) {
  return t.middleware(async opts => {
    const user = opts.ctx.user;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    const rate = consumeRateLimit(`user:${user.id}:${opts.path}`, limit, windowMs);
    if (!rate.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests. Please wait and try again.", cause: { retryAfterSeconds: Math.ceil(rate.retryAfterMs / 1000) } });
    return opts.next();
  });
}

export const uploadProcedure = protectedProcedure.use(rateLimited(12, 60_000));
export const sensitiveProcedure = protectedProcedure.use(rateLimited(30, 60_000));

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
