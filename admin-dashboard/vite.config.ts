import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages at https://movinesta.github.io/MoviNesta/
// HashRouter is used, so no rewrites are needed.
export default defineConfig({
  base: "/MoviNesta/admin/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
});
