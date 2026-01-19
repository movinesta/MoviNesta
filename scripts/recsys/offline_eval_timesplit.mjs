#!/usr/bin/env node
/* eslint-disable no-console */

// Offline evaluation with time-based splits + beyond-accuracy metrics.
//
// Inputs:
//  - JSONL media events (from export_interactions.mjs)
//  - JSONL item metadata (from export_items.mjs)
//
// Metrics:
//  - HitRate@K, MRR@K, NDCG@K
//  - Catalog coverage
//  - Novelty (inverse log popularity)
//  - Intra-list diversity (genre Jaccard-based, sampled)
//
// Usage:
//  node scripts/recsys/offline_eval_timesplit.mjs --events ./tmp/media_events.jsonl --items ./tmp/media_items.jsonl --k 20 --test_points 3

import fs from "node:fs";
import readline from "node:readline";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return fallback;
  return next;
}

const eventsPath = argValue("--events", null);
const itemsPath = argValue("--items", null);
const k = Number(argValue("--k", "20"));
const testPoints = Number(argValue("--test_points", "3"));
const maxPairs = Number(argValue("--max_pairs", "120"));

if (!eventsPath || !itemsPath) {
  console.error(
    "Usage: node scripts/recsys/offline_eval_timesplit.mjs --events <media_events.jsonl> --items <media_items.jsonl> [--k 20] [--test_points 3]",
  );
  process.exit(1);
}
if (!fs.existsSync(eventsPath)) {
  console.error("Events file not found:", eventsPath);
  process.exit(1);
}
if (!fs.existsSync(itemsPath)) {
  console.error("Items file not found:", itemsPath);
  process.exit(1);
}
if (!Number.isFinite(k) || k <= 0 || k > 200) {
  console.error("--k must be between 1 and 200");
  process.exit(1);
}
if (!Number.isFinite(testPoints) || testPoints < 1 || testPoints > 20) {
  console.error("--test_points must be between 1 and 20");
  process.exit(1);
}

// Positive definition aligned with product goals.
const POSITIVE_TYPES = new Set(["like", "watchlist"]);

function isPositive(ev) {
  const t = String(ev?.event_type ?? "");
  if (POSITIVE_TYPES.has(t)) return true;
  const r = ev?.rating_0_10;
  if (r != null) {
    const n = Number(r);
    if (Number.isFinite(n) && n >= 7) return true;
  }
  return false;
}

function dcg(rank) {
  return 1 / Math.log2(rank + 1);
}
function ndcgAtK(rank, K) {
  if (rank < 1 || rank > K) return 0;
  return dcg(rank) / dcg(1);
}

function parseGenres(omdbGenre) {
  if (!omdbGenre) return [];
  return String(omdbGenre)
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

function jaccard(a, b) {
  if (!a.length && !b.length) return 1;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

// Load item metadata.
/** @type {Map<string, {genres:string[]}>} */
const items = new Map();
{
  const rl = readline.createInterface({ input: fs.createReadStream(itemsPath, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    let row;
    try {
      row = JSON.parse(t);
    } catch {
      continue;
    }
    const id = String(row?.id ?? "");
    if (!id) continue;
    items.set(id, { genres: parseGenres(row?.omdb_genre) });
  }
}

// Read events and collect per-user positives sorted by time.
/** @type {Map<string, Array<{ts:number, item:string}>>} */
const byUser = new Map();
let rows = 0;
{
  const rl = readline.createInterface({ input: fs.createReadStream(eventsPath, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev;
    try {
      ev = JSON.parse(trimmed);
    } catch {
      continue;
    }
    rows += 1;
    if (!isPositive(ev)) continue;
    const user = String(ev.user_id ?? "");
    const item = String(ev.media_item_id ?? "");
    const ts = Date.parse(String(ev.created_at ?? "")) || 0;
    if (!user || !item || !ts) continue;
    const arr = byUser.get(user) ?? [];
    arr.push({ ts, item });
    byUser.set(user, arr);
  }
}
for (const arr of byUser.values()) arr.sort((a, b) => a.ts - b.ts);

// Split per-user by time: train first, test last N points.
/** @type {Map<string, Set<string>>} */
const trainByUser = new Map();
/** @type {Map<string, Array<string>>} */
const testByUser = new Map();
for (const [u, arr] of byUser.entries()) {
  if (arr.length < 2) continue;
  const tp = Math.min(testPoints, Math.max(1, arr.length - 1));
  const test = arr.slice(-tp).map((x) => x.item);
  const train = arr.slice(0, -tp).map((x) => x.item);
  if (!train.length || !test.length) continue;
  trainByUser.set(u, new Set(train));
  testByUser.set(u, test);
}

// Popularity baseline from train.
/** @type {Map<string, number>} */
const pop = new Map();
for (const s of trainByUser.values()) {
  for (const item of s) pop.set(item, (pop.get(item) ?? 0) + 1);
}
const sortedPopular = [...pop.entries()].sort((a, b) => b[1] - a[1]).map(([item]) => item);
const totalTrainItems = sortedPopular.length;

// Evaluate: recommend top-K popular items not already seen.
let users = 0;
let testTotal = 0;
let hit = 0;
let mrrSum = 0;
let ndcgSum = 0;
let noveltySum = 0;
let divSum = 0;
let divLists = 0;
const recommendedItems = new Set();
/** @type {Map<string, number>} */
const recGenreCounts = new Map();

function addGenresToMap(map, genres) {
  for (const g of genres) map.set(g, (map.get(g) ?? 0) + 1);
}

// Catalog genre prior (from exported items)
/** @type {Map<string, number>} */
const catalogGenreCounts = new Map();
for (const it of items.values()) addGenresToMap(catalogGenreCounts, it.genres);

function normalizeCounts(map) {
  let s = 0;
  for (const v of map.values()) s += v;
  const out = new Map();
  for (const [k, v] of map.entries()) out.set(k, s ? v / s : 0);
  return out;
}

function jsDivergence(p, q) {
  // Jensen-Shannon divergence in nats; bounded [0, ln(2)]
  const keys = new Set([...p.keys(), ...q.keys()]);
  const m = new Map();
  for (const k of keys) m.set(k, 0.5 * ((p.get(k) ?? 0) + (q.get(k) ?? 0)));
  const kl = (a, b) => {
    let sum = 0;
    for (const k of keys) {
      const x = a.get(k) ?? 0;
      const y = b.get(k) ?? 0;
      if (x > 0 && y > 0) sum += x * Math.log(x / y);
    }
    return sum;
  };
  return 0.5 * kl(p, m) + 0.5 * kl(q, m);
}

function noveltyOf(item) {
  const c = pop.get(item) ?? 0;
  // inverse log popularity (higher => more novel)
  return 1 / Math.log2(2 + c);
}

for (const [u, tests] of testByUser.entries()) {
  const seen = trainByUser.get(u);
  if (!seen) continue;
  users += 1;

  const recs = [];
  for (const item of sortedPopular) {
    if (seen.has(item)) continue;
    recs.push(item);
    recommendedItems.add(item);
    if (recs.length >= k) break;
  }

  // list novelty
  for (const it of recs) noveltySum += noveltyOf(it);

  // recommendation genre distribution (for fairness/diversity monitoring)
  for (const it of recs) addGenresToMap(recGenreCounts, items.get(it)?.genres ?? []);

  // diversity: sample pairwise genre Jaccard
  const genres = recs.map((it) => items.get(it)?.genres ?? []);
  let pairs = 0;
  let simSum = 0;
  for (let i = 0; i < genres.length; i++) {
    for (let j = i + 1; j < genres.length; j++) {
      simSum += jaccard(genres[i], genres[j]);
      pairs += 1;
      if (pairs >= maxPairs) break;
    }
    if (pairs >= maxPairs) break;
  }
  if (pairs > 0) {
    const avgSim = simSum / pairs;
    divSum += 1 - avgSim;
    divLists += 1;
  }

  for (const testItem of tests) {
    testTotal += 1;
    const idx = recs.indexOf(testItem);
    if (idx !== -1) {
      hit += 1;
      const rank = idx + 1;
      mrrSum += 1 / rank;
      ndcgSum += ndcgAtK(rank, k);
    }
  }
}

const denom = testTotal || 1;
const hitRate = hit / denom;
const mrr = mrrSum / denom;
const ndcg = ndcgSum / denom;
const coverage = totalTrainItems ? recommendedItems.size / totalTrainItems : 0;
const avgNovelty = users ? noveltySum / (users * k) : 0;
const avgDiversity = divLists ? divSum / divLists : 0;
const jsd = jsDivergence(normalizeCounts(recGenreCounts), normalizeCounts(catalogGenreCounts));

console.log("\nOffline eval: Time-split Popularity baseline");
console.log(`Input rows: ${rows}`);
console.log(`Users evaluated: ${users}`);
console.log(`Total test interactions: ${testTotal}`);
console.log(`HitRate@${k}: ${hitRate.toFixed(4)}`);
console.log(`MRR@${k}: ${mrr.toFixed(4)}`);
console.log(`NDCG@${k}: ${ndcg.toFixed(4)}`);
console.log(`Catalog coverage: ${coverage.toFixed(4)}`);
console.log(`Avg novelty (1/log pop): ${avgNovelty.toFixed(4)}`);
console.log(`Avg intra-list diversity (genre): ${avgDiversity.toFixed(4)}`);
console.log(`Genre distribution drift (JSD vs catalog): ${jsd.toFixed(4)}`);

console.log("\nNotes:");
console.log("- Novelty/diversity rely on omdb_genre; export items first.");
console.log("- Next: slice by experiments using rec_impressions_enriched_v1.request_context.experiments (context is joined from rec_requests).");
