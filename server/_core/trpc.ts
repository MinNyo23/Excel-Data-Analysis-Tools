import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { consumeRateLimit } from "../security";

type PublicErrorShape = {
  message: string;
  data: { code: string; httpStatus: number; [key: string]: unknown };
};

export function redactTRPCErrorShape(shape: PublicErrorShape, errorCode: string) {
  const publicMessage = errorCode === "INTERNAL_SERVER_ERROR"
    ? "Request could not be completed."
    : errorCode === "NOT_FOUND"
      ? "The requested API operation was not found."
      : shape.message;
  return {
    ...shape,
    message: publicMessage,
    data: {
      code: shape.data.code,
      httpStatus: shape.data.httpStatus,
    },
  };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Do not expose internal stack traces, filesystem paths, procedure paths, or
    // validation implementation details in the browser-facing API response.
    return redactTRPCErrorShape(shape, error.code) as typeof shape;
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
    if (!rate.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests. Please wait and try again." });
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
