import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Read the monorepo root's package.json (not client/package.json) so the
// UI shows the overall app version. This runs in Node during config load,
// not in client-served code, so it isn't subject to Vite's dev-server
// filesystem restrictions the way a browser-side import would be.
const rootPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf-8"),
) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPackageJson.version),
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        // Overridable so the dual-service Docker Compose dev setup can
        // point at the "server" container instead of localhost.
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
