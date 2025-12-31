// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base =
    env.VITE_BASE_URL?.trim() || (mode === "production" ? "/MoviNesta/" : "/");

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["src/__tests__/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["supabase/**", "admin-dashboard/**", "docs/**"],
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
      outDir: "docs", // ⬅️ change this from "dist" to "docs"
      chunkSizeWarningLimit: 2000,
    },
  };
});
