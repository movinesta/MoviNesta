import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  base: "/MoviNesta/",
  plugins: [react()],
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
  },
});
