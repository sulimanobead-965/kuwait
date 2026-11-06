import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve("/workspace/artifacts/play-src"),
  resolve: { alias: { "@": path.resolve("/workspace/src") } },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve("/workspace/artifacts/play-dist"),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "game.js",
        assetFileNames: "game[extname]",
      },
    },
  },
});
