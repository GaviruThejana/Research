import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { build } from "vite";
import react from "@vitejs/plugin-react";

// Build directly through Vite's API. Vite 5's CLI bundles vite.config.js
// with esbuild first, which attempts to inspect directories above this
// sandboxed workspace on Windows. configFile:false skips that config-loader
// scan while preserving the same React plugin and paths inside web/.
const webRoot = fileURLToPath(new URL(".", import.meta.url));

await build({
  configFile: false,
  root: webRoot,
  envDir: webRoot,
  cacheDir: resolve(webRoot, "node_modules/.vite"),
  plugins: [react()],
  build: {
    outDir: resolve(webRoot, "dist"),
    emptyOutDir: true,
  },
});
