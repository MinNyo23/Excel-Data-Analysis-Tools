import dotenv from "dotenv";

// v0 injects project variables outside the repository. Load that file explicitly
// so the Vite client receives the configured Supabase and reCAPTCHA settings.
dotenv.config({ path: "/vercel/share/.env.project" });
dotenv.config();
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerRecaptchaRoutes } from "../recaptcha";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { apiRequestGuards, externalApiCors, securityHeaders } from "../security";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use("/api", externalApiCors);
  app.use("/api", apiRequestGuards);
  // Uploads are base64-encoded in JSON. The route-level validation applies a
  // stricter 10 MB per file / 20 MB batch limit after parsing.
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerRecaptchaRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Server] Unhandled request failure", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) res.status(500).json({ error: "Request could not be completed." });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
