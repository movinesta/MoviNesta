import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const adminDir = path.join(rootDir, "admin-dashboard");
const adminDistDir = path.join(adminDir, "dist");
const docsAdminDir = path.join(rootDir, "docs", "admin");

const run = (command, cwd = rootDir) => {
  execSync(command, {
    cwd,
    stdio: "inherit",
  });
};

function getPinnedPnpmSpec() {
  try {
    const raw = readFileSync(path.join(adminDir, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    const pm = typeof pkg?.packageManager === "string" ? pkg.packageManager.trim() : "";
    if (pm.startsWith("pnpm@") && pm.length > "pnpm@".length) return pm;
  } catch {
    // ignore
  }
  return "";
}

function getPnpmRunner() {
  const pinned = getPinnedPnpmSpec();

  // Prefer npx to run the pinned pnpm without requiring global activation.
  // This avoids Windows permission issues when Corepack tries to write shims under Program Files.
  if (pinned) return `npx -y ${pinned}`;

  // Fall back to a globally installed pnpm.
  return "pnpm";
}

const PNPM = getPnpmRunner();

try {
  run(`${PNPM} --version`);
} catch (error) {
  console.error(
    `pnpm is required to build the admin dashboard. Tried: ${PNPM}. If you do not have pnpm, set \"packageManager\" in admin-dashboard/package.json (e.g. \"pnpm@10.26.1\") or install pnpm globally.`,
    error,
  );
  process.exit(1);
}

try {
  console.log("Installing admin dashboard dependencies...");
  run(`${PNPM} install --frozen-lockfile`, adminDir);

  console.log("Building admin dashboard...");
  run(`${PNPM} run build`, adminDir);

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
