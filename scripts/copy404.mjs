import { copyFileSync, existsSync } from "node:fs";

try {
  if (existsSync("docs/index.html")) {
    copyFileSync("docs/index.html", "docs/404.html");
    console.log("Created docs/404.html for SPA fallback.");
  } else {
    console.warn("docs/index.html not found; did you run `vite build` first?");
  }
} catch (error) {
  console.error("Failed to create docs/404.html", error);
  process.exit(1);
}
