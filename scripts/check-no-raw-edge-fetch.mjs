#!/usr/bin/env node
/*
  Prevent regressions where UI code directly fetches ".../functions/v1/...".
  All client-side Edge Function calls should go through:
    - src/lib/callSupabaseFunction.ts (JSON invoke via supabase-js)
    - src/lib/edgeFetch.ts (raw fetch for streaming/SSE)
*/

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");

const allow = new Set([
  path.normalize(path.join(SRC_DIR, "lib", "edgeFetch.ts")),
]);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, out);
    } else if (e.isFile()) {
      if (!/\.(ts|tsx|js|jsx)$/.test(e.name)) continue;
      out.push(p);
    }
  }
  return out;
}

const hits = [];
const files = walk(SRC_DIR);

for (const file of files) {
  if (allow.has(path.normalize(file))) continue;
  const content = fs.readFileSync(file, "utf8");
  if (content.includes("functions/v1/")) {
    const rel = path.relative(ROOT, file);
    hits.push(rel);
  }
}

if (hits.length) {
  console.error("\nFound raw Edge Function fetch usage in src/ (functions/v1/) in:");
  for (const h of hits) console.error("  -", h);
  console.error("\nUse callSupabaseFunction(...) or fetchSupabaseEdgeFunction(...) instead.\n");
  process.exit(1);
}

console.log("OK: no raw /functions/v1/ usage in src/ (outside allowlist).");
