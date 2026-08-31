import dotenv from "dotenv";

dotenv.config();

import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { apiRequestGuards, externalApiCors, securityHeaders } from "../server/security";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);
app.use("/api", externalApiCors);
app.use("/api", apiRequestGuards);
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ limit: "4mb", extended: true }));
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

export default app;
