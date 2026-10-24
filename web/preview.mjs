import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { preview, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const webRoot = fileURLToPath(new URL(".", import.meta.url));
const env = loadEnv("production", webRoot, "VITE_");
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const nodeApi = { target: env.VITE_NODE_API_PROXY_TARGET || "http://localhost:5000", changeOrigin: true };

const server = await preview({
  configFile: false,
  root: webRoot,
  envDir: webRoot,
  cacheDir: resolve(webRoot, "node_modules/.vite"),
  plugins: [react()],
  preview: {
    host: argValue("--host", "0.0.0.0"),
    port: Number(argValue("--port", "4173")),
    proxy: { "/api": nodeApi, "/uploads": nodeApi },
  },
});

server.printUrls();
