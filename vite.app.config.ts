/**
 * Static build of the game alone, for the iPhone/iPad app (Capacitor copies
 * `dist-app` into the Xcode project). The website keeps using vite.config.ts.
 *   npm run app:build
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("./app"),
  base: "./",
  publicDir: here("./public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": here("./src") } },
  server: { fs: { allow: [here(".")] } },
  build: { outDir: here("./dist-app"), emptyOutDir: true, assetsInlineLimit: 0 },
});
