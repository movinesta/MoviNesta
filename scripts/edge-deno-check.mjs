#!/usr/bin/env node
/**
 * Type-check all Supabase Edge Functions using Deno.
 *
 * Usage:
 *   node scripts/edge-deno-check.mjs
 *   node scripts/edge-deno-check.mjs --only=media-swipe-deck,assistant-chat-reply
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT, "supabase", "functions");

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg
  ? onlyArg
      .slice("--only=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

function listFunctionDirs() {
  if (!fs.existsSync(FUNCTIONS_DIR)) return [];
  const dirs = [];
  for (const ent of fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (ent.name === "_shared" || ent.name.startsWith(".")) continue;
    if (ONLY && !ONLY.includes(ent.name)) continue;

    const dir = path.join(FUNCTIONS_DIR, ent.name);
    const entry = path.join(dir, "index.ts");
    const cfg = path.join(dir, "deno.json");
    if (!fs.existsSync(entry)) continue;
    if (!fs.existsSync(cfg)) continue;
    dirs.push({ name: ent.name, dir, entry, cfg });
  }
  return dirs.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveDenoBinary() {
  const candidates = [];
  if (process.env.DENO_BIN) candidates.push(process.env.DENO_BIN);

  const localBinary = path.join(ROOT, "node_modules", ".bin", "deno");
  if (fs.existsSync(localBinary)) candidates.push(localBinary);

  candidates.push("deno");

  for (const candidate of candidates) {
    const res = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (res.error) {
      if (res.error.code === "ENOENT") continue;
      continue;
    }

    if (typeof res.status === "number" && res.status !== 0) continue;
    return candidate;
  }

  return null;
}

const DENO_BIN = resolveDenoBinary();
if (!DENO_BIN) {
  const message = [
    "Deno is not installed or not on PATH.",
    "Install Deno or set DENO_BIN to a valid binary, then re-run.",
    "See: https://deno.com/",
  ].join(" ");

  if (process.env.CI) {
    console.error(`\n${message}\n`);
    process.exit(2);
  }

  console.warn(`\n${message}\nSkipping edge function typecheck in non-CI environments.\n`);
  process.exit(0);
}

function runDenoCheck({ name, entry, cfg }) {
  const args = ["check", "--config", cfg, entry];
  const res = spawnSync(DENO_BIN, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      DENO_NO_UPDATE_CHECK: "1",
    },
  });

  if (res.error) {
    console.error(`\nFailed running deno check for ${name}: ${String(res.error)}`);
    process.exit(2);
  }

  if (typeof res.status === "number" && res.status !== 0) {
    return res.status;
  }
  return 0;
}

const targets = listFunctionDirs();
if (!targets.length) {
  console.log("edge-deno-check: no functions found (or all filtered out)");
  process.exit(0);
}

let failures = 0;
for (const t of targets) {
  console.log(`\n[edge-deno-check] ${t.name}`);
  const code = runDenoCheck(t);
  if (code !== 0) failures += 1;
}

if (failures) {
  console.error(`\nedge-deno-check: FAIL (${failures} function${failures === 1 ? "" : "s"})`);
  process.exit(1);
}

console.log(`\nedge-deno-check: OK (${targets.length} function${targets.length === 1 ? "" : "s"})`);
