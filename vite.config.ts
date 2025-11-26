export default defineConfig({
  base: "/MoviNesta/",    // <-- REPO name inside slashes
  plugins: [react()],
  build: {
    outDir: "dist",       // default build folder
    chunkSizeWarningLimit: 2000,
  },
  // server config is fine only for dev
});
