#!/usr/bin/env node
/**
 * scripts/check-edge-auth-guards.mjs
 *
 * Safety net for Supabase Edge Functions when `verify_jwt=false` is used.
 *
 * Ensures each Edge Function listed in supabase/config.toml contains at least
 * one explicit guard call, such as:
 * - requireAdmin(req)
 * - requireUserFromRequest(req, ...)
 * - requireInternalJob(req)
 * - requireApiKeyHeader(req)
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "supabase", "config.toml");

if (!fs.existsSync(configPath)) {
  console.error(`[edge-auth] Missing supabase/config.toml at: ${configPath}`);
  process.exit(1);
}

const configToml = fs.readFileSync(configPath, "utf8");
const fnNames = Array.from(configToml.matchAll(/^\[functions\.([^\]]+)\]\s*$/gm)).map((m) => m[1]);

if (!fnNames.length) {
  console.warn("[edge-auth] No [functions.*] entries found in supabase/config.toml. Skipping.");
  process.exit(0);
}

const functionsDir = path.join(root, "supabase", "functions");

const guardRegexes = [
  /\brequireAdmin\s*\(/,
  /\brequireUserFromRequest\s*\(/,
  /\brequireInternalJob\s*\(/,
  /\brequireInternal\w*\s*\(/,
  /\brequireApiKeyHeader\s*\(/,
  /\.auth\.getUser\s*\(/,
  /\bauth\.getUser\s*\(/,
  /\bgetClaims\s*\(/,
  /INTERNAL_JOB_TOKEN/,
  /\bx-job-token\b/,
  /req\.headers\.get\(["']apikey["']\)/,
  /\bgetUserIdFromRequest\s*\(/,
];

const allowNoGuard = new Set([
  // If you intentionally add a public function that does not need any explicit
  // guard, add it here and document why.
]);

const missing = [];

for (const name of fnNames) {
  if (allowNoGuard.has(name)) continue;

  const entry = path.join(functionsDir, name, "index.ts");
  if (!fs.existsSync(entry)) {
    // Function may be removed/renamed but still listed; report to avoid drift.
    missing.push({ name, file: entry });
    continue;
  }

  const src = fs.readFileSync(entry, "utf8");
  const hasGuard = guardRegexes.some((re) => re.test(src));

  if (!hasGuard) {
    missing.push({ name, file: entry });
  }
}

if (missing.length) {
  console.error("[edge-auth] Missing explicit auth guard in these Edge Functions:");
  for (const it of missing) {
    console.error(`  - ${it.name}  (${it.file})`);
  }
  console.error("\nExpected one of: requireAdmin, requireUserFromRequest, requireInternalJob, requireApiKeyHeader.");
  console.error("If a function is intentionally public without a guard, add it to allowNoGuard and document it.");
  process.exit(1);
}

console.log(`[edge-auth] OK - explicit auth guard present in ${fnNames.length} configured Edge Functions.`);
