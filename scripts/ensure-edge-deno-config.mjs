#!/usr/bin/env node
/**
 * Ensure all Supabase Edge Functions use a consistent Deno config.
 *
 * Usage:
 *   node scripts/ensure-edge-deno-config.mjs            # check only
 *   node scripts/ensure-edge-deno-config.mjs --write    # rewrite files
 */

import fs from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');

const repoRoot = process.cwd();
const functionsDir = path.join(repoRoot, 'supabase', 'functions');

const baselineImports = {
  supabase: 'npm:@supabase/supabase-js@2.90.1',
  zod: 'npm:zod@3.23.8',
};

function listDenoJsonFiles() {
  const files = [];

  const rootCfg = path.join(functionsDir, 'deno.json');
  if (fs.existsSync(rootCfg)) files.push(rootCfg);

  for (const ent of fs.readdirSync(functionsDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const fp = path.join(functionsDir, ent.name, 'deno.json');
    if (fs.existsSync(fp)) files.push(fp);
  }

  return files.sort();
}

function readJson(fp) {
  const raw = fs.readFileSync(fp, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${fp}: ${String(err)}`);
  }
}

function normalizeConfig(cfg) {
  const out = { ...cfg };
  out.lock = false;
  out.nodeModulesDir = 'none';

  const imports = { ...(cfg.imports ?? {}) };
  imports.supabase = baselineImports.supabase;
  imports.zod = baselineImports.zod;
  out.imports = imports;

  // Friendly key order
  const ordered = {
    lock: out.lock,
    nodeModulesDir: out.nodeModulesDir,
    imports: out.imports,
  };

  // Preserve any other keys the function may already have
  for (const [k, v] of Object.entries(out)) {
    if (k in ordered) continue;
    ordered[k] = v;
  }

  return ordered;
}

function stableStringify(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

const files = listDenoJsonFiles();
if (files.length === 0) {
  console.error('No deno.json files found under supabase/functions.');
  process.exit(2);
}

let changed = 0;
for (const fp of files) {
  const original = readJson(fp);
  const normalized = normalizeConfig(original);

  const originalStr = stableStringify(original);
  const normalizedStr = stableStringify(normalized);

  if (originalStr !== normalizedStr) {
    changed += 1;
    if (WRITE) {
      fs.writeFileSync(fp, normalizedStr, 'utf8');
      console.log(`Updated ${path.relative(repoRoot, fp)}`);
    } else {
      console.log(`Needs update: ${path.relative(repoRoot, fp)}`);
    }
  }
}

if (!WRITE && changed > 0) {
  console.error(`\n${changed} deno.json file(s) need updates. Re-run with --write.`);
  process.exit(1);
}

console.log(WRITE ? '\nDeno configs updated.' : '\nDeno configs OK.');
