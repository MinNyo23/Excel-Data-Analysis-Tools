import dotenv from "dotenv";
import path from "node:path";
import { defineConfig } from "vite";
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

dotenv.config({ path: "/vercel/share/.env.project" });
dotenv.config();

export default defineConfig({
  plugins: [react(), tailwindcss(), jsxLocPlugin()],
  define: {
    "import.meta.env.VITE_USE_SUPABASE_AUTH": JSON.stringify(process.env.VITE_USE_SUPABASE_AUTH),
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.VITE_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    "import.meta.env.VITE_USE_EXTERNAL_PROCESSING_API": JSON.stringify(process.env.VITE_USE_EXTERNAL_PROCESSING_API),
    "import.meta.env.VITE_PROCESSING_API_URL": JSON.stringify(process.env.VITE_PROCESSING_API_URL),
    "import.meta.env.VITE_RECAPTCHA_SITE_KEY": JSON.stringify(process.env.VITE_RECAPTCHA_SITE_KEY?.trim() || ""),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    hmr: false,
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: { strict: true, deny: ["**/.*"] },
  },
});
