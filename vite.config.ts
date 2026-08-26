import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: "/",
  plugins: [react()],
  build: {
    outDir: mode === "static" ? "dist/static" : "dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 4173,
  },
}));
