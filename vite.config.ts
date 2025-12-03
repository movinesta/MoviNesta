// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  base: "/MoviNesta/", // ✅ this is correct for a repo named MoviNesta
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 10,
        branches: 4,
        functions: 4,
        lines: 10,
      },
    },
  },
  build: {
    outDir: "docs",          // ⬅️ change this from "dist" to "docs"
    chunkSizeWarningLimit: 2000,
  },
});
