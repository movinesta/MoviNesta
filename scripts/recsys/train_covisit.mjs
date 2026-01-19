#!/usr/bin/env node
/* eslint-disable no-console */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

/**
 * Co-visitation baseline (item-item) from implicit positive outcomes.
 *
 * Output:
 *  - covisit_model.json : { generatedAt, windowDays, topK, itemTop: {itemId: [[otherId,score],...]}, popularity: {itemId: count} }
 *
 * Notes:
 *  - This is a lightweight baseline suitable for early-stage data.
 *  - It does NOT require embeddings or heavy ML infra.
 */

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

const SUPABASE_URL = process.env.SUPABASE_URL || argValue("--url");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || argValue("--service-key");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (or --url/--service-key)");
  process.exit(1);
}

const windowDays = clamp(argValue("--days", "90"), 7, 365);
const topK = clamp(argValue("--topk", "200"), 20, 2000);
const outFile = argValue("--out", path.join(process.cwd(), "covisit_model.json"));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const POSITIVE = new Set(["like", "watchlist_add", "rating"]);

function isoDate(d) {
  return d.toISOString();
}

async function fetchAllRows(sinceIso) {
  // Pull outcomes. We only need user_id, media_item_id, outcome_type, created_at.
  // Paginate using created_at cursor.
  let all = [];
  let cursor = null;

  while (true) {
    let q = supabase
      .from("rec_outcomes")
      .select("user_id,media_item_id,outcome_type,created_at,rating_0_10")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(5000);

    if (cursor) q = q.gt("created_at", cursor);

    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;

    all.push(...data);
    cursor = data[data.length - 1].created_at;
    if (data.length < 5000) break;
  }

  return all;
}

function isPositive(row) {
  if (!row?.outcome_type) return false;
  if (row.outcome_type === "rating") {
    const r = Number(row.rating_0_10);
    return Number.isFinite(r) && r >= 7;
  }
  return POSITIVE.has(row.outcome_type);
}

function addTopK(map, a, b, w) {
  let m = map.get(a);
  if (!m) {
    m = new Map();
    map.set(a, m);
  }
  m.set(b, (m.get(b) || 0) + w);
}

async function main() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - windowDays);

  console.log(`Fetching rec_outcomes since ${since.toISOString()}…`);
  const rows = await fetchAllRows(isoDate(since));
  console.log(`Loaded ${rows.length} rows`);

  const byUser = new Map();
  const popularity = new Map();

  for (const r of rows) {
    if (!isPositive(r)) continue;
    if (!r.user_id || !r.media_item_id) continue;

    popularity.set(r.media_item_id, (popularity.get(r.media_item_id) || 0) + 1);

    let arr = byUser.get(r.user_id);
    if (!arr) {
      arr = [];
      byUser.set(r.user_id, arr);
    }
    arr.push(r.media_item_id);
  }

  // Build co-visitation counts
  const pairCounts = new Map(); // item -> Map(other -> count)
  for (const [, items] of byUser) {
    // De-duplicate per user to reduce spam
    const uniq = Array.from(new Set(items));
    for (let i = 0; i < uniq.length; i++) {
      for (let j = 0; j < uniq.length; j++) {
        if (i === j) continue;
        addTopK(pairCounts, uniq[i], uniq[j], 1);
      }
    }
  }

  // Keep topK neighbors per item
  const itemTop = {};
  for (const [itemId, m] of pairCounts) {
    const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, topK);
    itemTop[itemId] = sorted;
  }

  const popObj = {};
  for (const [k, v] of popularity) popObj[k] = v;

  const model = {
    kind: "covisitation_v1",
    generatedAt: new Date().toISOString(),
    windowDays,
    topK,
    itemTop,
    popularity: popObj,
  };

  fs.writeFileSync(outFile, JSON.stringify(model));
  console.log(`Wrote ${outFile} (items=${Object.keys(itemTop).length})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
