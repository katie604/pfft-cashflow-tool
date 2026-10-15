import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// Served from GitHub Pages at /pfft-cashflow-tool/ — assets must be base-aware.
export default defineConfig({
  base: "/pfft-cashflow-tool/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "docs"),
    emptyOutDir: true,
  },
  server: {
    // 127.0.0.1, never `true`. `host: true` binds to ALL interfaces, so anyone on
    // the same WiFi can open this dev server - and it renders client financial data.
    // AI Her Way, 5 Rules for Secure MCP Connections, Rule 5: "Run on localhost only
    // (127.0.0.1), never on 0.0.0.0". Changed 11 Sep 2026; `host: true` was a scaffold
    // default from the initial commit, not a deliberate choice.
    // Need it on another device? Use a VPN for that session - do not make this permanent.
    host: "127.0.0.1",
  },
});
