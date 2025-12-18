import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const adminDir = path.join(rootDir, "admin-dashboard");
const adminDistDir = path.join(adminDir, "dist");
const docsAdminDir = path.join(rootDir, "docs", "admin");

const run = (command, cwd) => {
  execSync(command, {
    cwd,
    stdio: "inherit",
  });
};

try {
  // Ensure pnpm is available before proceeding.
  run("pnpm --version", rootDir);
} catch (error) {
  console.error("pnpm is required to build the admin dashboard. Install it via `corepack enable pnpm`.", error);
  process.exit(1);
}

try {
  console.log("Installing admin dashboard dependencies...");
  run("pnpm install --frozen-lockfile", adminDir);

  console.log("Building admin dashboard...");
  run("pnpm run build", adminDir);

  console.log("Copying admin dashboard build to docs/admin...");
  rmSync(docsAdminDir, { recursive: true, force: true });
  mkdirSync(path.dirname(docsAdminDir), { recursive: true });
  cpSync(adminDistDir, docsAdminDir, { recursive: true });

  const adminIndex = path.join(docsAdminDir, "index.html");
  if (existsSync(adminIndex)) {
    copyFileSync(adminIndex, path.join(docsAdminDir, "404.html"));
  }

  console.log("Admin dashboard build copied to docs/admin");
} catch (error) {
  console.error("Failed to build or copy admin dashboard", error);
  process.exit(1);
}
