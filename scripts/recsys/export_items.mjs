#!/usr/bin/env node
/* eslint-disable no-console */

// Export lightweight item metadata needed for offline evaluation.
//
// Output is JSONL, one row per media item.
//
// Usage:
//   node scripts/recsys/export_items.mjs --out ./tmp/media_items.jsonl
//
// Requires env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return fallback;
  return next;
}

const outPath = argValue("--out", "./tmp/media_items.jsonl");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const outAbs = path.resolve(process.cwd(), outPath);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
const stream = fs.createWriteStream(outAbs, { flags: "w" });

console.log(`Exporting public.media_items -> ${outAbs}`);

const PAGE = 1000;
let offset = 0;
let total = 0;

while (true) {
  const { data, error } = await supabase
    .from("media_items")
    .select("id,kind,tmdb_id,omdb_title,omdb_year,omdb_genre,omdb_actors,omdb_director")
    .order("id", { ascending: true })
    .range(offset, offset + PAGE - 1);

  if (error) {
    console.error("Query failed:", error);
    process.exit(1);
  }
  if (!data || data.length === 0) break;

  for (const row of data) {
    stream.write(JSON.stringify(row) + "\n");
  }

  total += data.length;
  offset += PAGE;
  if (total % 5000 === 0) console.log(`... ${total} rows`);
}

stream.end();
console.log(`Done. Wrote ${total} rows.`);
