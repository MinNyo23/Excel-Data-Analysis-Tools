import dotenv from "dotenv";

dotenv.config();

import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { apiRequestGuards, externalApiCors, noStoreApiResponse, securityHeaders } from "../server/security.js";

const app = express();
const configuredTrustProxy = Number(process.env.TRUST_PROXY_HOPS ?? "0");
app.set("trust proxy", Number.isInteger(configuredTrustProxy) && configuredTrustProxy >= 0 ? configuredTrustProxy : 0);
app.disable("x-powered-by");
// The application only accepts flat form fields. Avoid the nested qs parser
// attack surface for query strings and URL-encoded request bodies.
app.set("query parser", "simple");
app.use(securityHeaders);
app.use("/api", noStoreApiResponse);
app.use("/api", externalApiCors);
app.use("/api", apiRequestGuards);
// Workbook uploads are base64-encoded before reaching tRPC.
app.use(express.json({ limit: "48mb" }));
app.use(express.urlencoded({ limit: "48mb", extended: true }));
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
    return res.status(413).json({ error: "The uploaded workbook is too large. Please use a smaller file or enable external processing." });
  }
  console.error("[API] Unhandled request failure", error instanceof Error ? error.message : "unknown error");
  if (!res.headersSent) return res.status(500).json({ error: "Request could not be completed." });
});

export default app;
