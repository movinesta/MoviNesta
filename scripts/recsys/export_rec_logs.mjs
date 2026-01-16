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
const outDir = argValue("--outDir", "./tmp");

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

const outAbsDir = path.resolve(process.cwd(), outDir);
fs.mkdirSync(outAbsDir, { recursive: true });

const impPath = path.join(outAbsDir, "rec_impressions.jsonl");
const outPath = path.join(outAbsDir, "rec_outcomes.jsonl");

const impStream = fs.createWriteStream(impPath, { flags: "w" });
const outStream = fs.createWriteStream(outPath, { flags: "w" });

const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

async function exportTable(table, select, stream) {
  const PAGE = 2000;
  let offset = 0;
  let total = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error(`${table} export failed:`, error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const row of data) stream.write(JSON.stringify(row) + "\n");

    total += data.length;
    offset += PAGE;
    if (total % 10000 === 0) console.log(`... ${table}: ${total} rows`);
  }
  return total;
}

console.log(`Exporting rec logs since ${since} -> ${outAbsDir}`);

const nImp = await exportTable(
  "rec_impressions",
  "id,rec_request_id,user_id,session_id,deck_id,media_item_id,position,source,request_context,created_at",
  impStream,
);
const nOut = await exportTable(
  "rec_outcomes",
  "id,rec_request_id,user_id,session_id,deck_id,media_item_id,position,source,outcome_type,dwell_ms,rating_0_10,in_watchlist,created_at,payload",
  outStream,
);

impStream.end();
outStream.end();

console.log(`Done. Wrote ${nImp} impressions and ${nOut} outcomes.`);
