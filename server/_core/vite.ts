import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

/** Dev-only Vite middleware. Production imports `serveStatic` from `./static.js` instead. */
export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    // The managed preview proxy terminates TLS and does not expose Vite's
    // upgrade route reliably. Disable HMR transport to prevent browser-side
    // WebSocket failures; the dev page still refreshes normally on reload.
    hmr: false,
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      // The managed preview proxy does not forward Vite's development
      // WebSocket upgrade route. Remove the injected HMR client so it cannot
      // create a failing browser WebSocket connection; normal page refreshes
      // still load the latest client entry thanks to the cache-busting URL.
      const page = (await vite.transformIndexHtml(url, template))
        // The managed preview proxy does not support Vite's HMR WebSocket.
        // Strip every Vite client form after all transformIndexHtml hooks run,
        // including module scripts and inline imports injected by plugins.
        .replace(/<script\b[^>]*\bsrc=["'][^"']*(?:@vite\/client|vite\/dist\/client)[^"']*["'][^>]*>[\s\S]*?<\/script\s*>/gi, "")
        .replace(/<script\b[^>]*type=["']module["'][^>]*>[\s\S]*?import[\s\S]*?(?:@vite\/client|vite\/dist\/client)[\s\S]*?<\/script\s*>/gi, "")
        .replace(/(?:import\s+(?:[^;]*?\s+from\s+)?|import\s*\()["'][^"']*(?:@vite\/client|vite\/dist\/client)[^"']*["']\)?\s*;?/g, "");
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
