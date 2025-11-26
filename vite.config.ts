import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  // `./` gives you relative asset paths, good for GitHub Pages
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "docs",              // 👈 add this
    chunkSizeWarningLimit: 2000, // keep your existing option
  },
});
