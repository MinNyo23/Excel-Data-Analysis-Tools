import dotenv from "dotenv";

dotenv.config();

import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { registerOAuthRoutes } from "../server/_core/oauth.js";
import { apiRequestGuards, externalApiCors, noStoreApiResponse, securityHeaders } from "../server/security.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);
app.use("/api", noStoreApiResponse);
app.use("/api", externalApiCors);
app.use("/api", apiRequestGuards);
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ limit: "4mb", extended: true }));
registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

export default app;
