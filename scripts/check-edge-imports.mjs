#!/usr/bin/env node
/*
  scripts/check-edge-imports.mjs

  Prevent Supabase Edge Function bundle failures by rejecting remote HTTP(S) imports
  and common invalid JSR patterns (e.g. "jsr:/@std/http").

  This script is intentionally conservative and only scans "supabase/functions".
*/

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT, "supabase", "functions");

const BAD_PREFIXES = ["http://", "https://"];
const BAD_SUBSTRINGS = ["deno.land/", "esm.sh/", "cdn.jsdelivr.net/"];
const BAD_JSR_PREFIXES = ["jsr:/", "jsr://"];

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
      out.push(...walk(p));
    } else if (ent.isFile()) {
      if (p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".js") || p.endsWith(".mjs")) out.push(p);
    }
  }
  return out;
}

function extractSpecifiers(code) {
  const specs = [];

  // import ... from "..." / export ... from "..."
  const re1 = /\b(?:import|export)\s+(?:type\s+)?(?:[^;]*?)\s*from\s*["']([^"']+)["']/g;
  for (let m; (m = re1.exec(code)); ) specs.push(m[1]);

  // import("...")
  const re2 = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (let m; (m = re2.exec(code)); ) specs.push(m[1]);

  return specs;
}

function isBad(spec) {
  const s = String(spec || "").trim();
  if (!s) return null;

  for (const p of BAD_PREFIXES) {
    if (s.startsWith(p)) return `Remote HTTP import is not allowed: ${s}`;
  }

  for (const p of BAD_JSR_PREFIXES) {
    if (s.startsWith(p)) return `Invalid JSR specifier (should be "jsr:@..."): ${s}`;
  }

  for (const sub of BAD_SUBSTRINGS) {
    if (s.includes(sub)) return `Remote import is not allowed: ${s}`;
  }

  return null;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

let errors = 0;
const files = fs.existsSync(FUNCTIONS_DIR) ? walk(FUNCTIONS_DIR) : [];
for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  const specs = extractSpecifiers(code);
  for (const spec of specs) {
    const msg = isBad(spec);
    if (msg) {
      errors++;
      console.error(`${rel(file)}: ${msg}`);
    }
  }
}

if (errors) {
  console.error(`\ncheck-edge-imports: FAIL (${errors} issue${errors === 1 ? "" : "s"})`);
  process.exit(1);
}

console.log(`check-edge-imports: OK (${files.length} files scanned)`);
