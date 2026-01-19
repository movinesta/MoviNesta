#!/usr/bin/env node
/* eslint-disable no-console */

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

const days = Number(argValue("--days", "30"));
const outPath = argValue("--out", "./tmp/media_events.jsonl");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

if (!Number.isFinite(days) || days <= 0 || days > 3650) {
  console.error("--days must be between 1 and 3650");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const outAbs = path.resolve(process.cwd(), outPath);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
const stream = fs.createWriteStream(outAbs, { flags: "w" });

const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

console.log(`Exporting public.media_events since ${since} -> ${outAbs}`);

const PAGE = 1000;
let offset = 0;
let total = 0;

while (true) {
  const { data, error } = await supabase
    .from("media_events")
    .select(
      "id,user_id,session_id,deck_id,position,media_item_id,event_type,source,dwell_ms,rating_0_10,in_watchlist,created_at,payload",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: true })
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

  if (total % 5000 === 0) {
    console.log(`... ${total} rows`);
  }
}

stream.end();
console.log(`Done. Wrote ${total} rows.`);
