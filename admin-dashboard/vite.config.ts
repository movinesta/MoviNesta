import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Built to live under: docs/admin (GitHub Pages at https://movinesta.github.io/MoviNesta/admin/)
// HashRouter is used, so no rewrites are needed.
// base "./" keeps asset URLs relative, which is robust for subfolder hosting.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../docs/admin",
    emptyOutDir: true,
  },
});
