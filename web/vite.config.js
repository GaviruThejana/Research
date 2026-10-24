import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Anchor every Vite path to this config file. This avoids relying on the
// process working directory and keeps build, env, and cache paths inside web/.
const webRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  // Vite doesn't put .env values on process.env for this file; load only the
  // frontend variables from web/.env (never scan parent directories).
  const env = loadEnv(mode, webRoot, "VITE_");
  const nodeApi = { target: env.VITE_NODE_API_PROXY_TARGET || "http://localhost:5000", changeOrigin: true };

  return {
    root: webRoot,
    envDir: webRoot,
    cacheDir: resolve(webRoot, "node_modules/.vite"),
    plugins: [react()],
    build: {
      outDir: resolve(webRoot, "dist"),
      emptyOutDir: true,
    },
    // The Node API is the only backend (it forwards predictions to FastAPI).
    // Proxying keeps requests same-origin: no CORS, and phones on the LAN work too.
    server: {
      host: "0.0.0.0", // reachable from phones at http://<LAN-IP>:5173
      port: 5173, // the project's only web frontend (patient, doctor and admin)
      strictPort: true, // fail loudly instead of silently moving to another port
      fs: { strict: true },
      proxy: { "/api": nodeApi, "/uploads": nodeApi },
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
      proxy: { "/api": nodeApi, "/uploads": nodeApi },
    },
  };
});
