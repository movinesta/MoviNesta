#!/usr/bin/env node
/* eslint-disable no-console */

// Offline ranking evaluation (starter)
//
// Reads JSONL exported from public.media_events and evaluates a simple
// popularity baseline with richer ranking metrics.
//
// This script is deliberately dependency-free.
//
// Usage:
//   node scripts/recsys/offline_eval_ranking.mjs --in ./tmp/media_events.jsonl --k 20 --test_points 3

import fs from "node:fs";
import readline from "node:readline";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return fallback;
  return next;
}

const inPath = argValue("--in", null);
const k = Number(argValue("--k", "20"));
const testPoints = Number(argValue("--test_points", "3"));

if (!inPath) {
  console.error("Usage: node scripts/recsys/offline_eval_ranking.mjs --in <file.jsonl> [--k 20] [--test_points 3]");
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
if (!fs.existsSync(inPath)) {
  console.error("Input file not found:", inPath);
  process.exit(1);
}

// Minimal "positive" definition aligned with common media-product goals.
const POSITIVE_TYPES = new Set(["like", "watchlist"]);

function isPositive(ev) {
  const t = String(ev?.event_type ?? "");
  if (POSITIVE_TYPES.has(t)) return true;
  // Ratings: treat >= 7 as positive.
  const r = ev?.rating_0_10;
  if (r != null) {
    const n = Number(r);
    if (Number.isFinite(n) && n >= 7) return true;
  }
  return false;
}

function dcg(rank) {
  // Binary relevance (1 if hit). DCG contribution at 1-indexed rank.
  return 1 / Math.log2(rank + 1);
}

function ndcgAtK(rank, K) {
  if (rank < 1 || rank > K) return 0;
  const ideal = dcg(1);
  return dcg(rank) / ideal;
}

// Read JSONL and collect per-user positives sorted by time.
/** @type {Map<string, Array<{ts:number, item:string}>>} */
const byUser = new Map();

const rl = readline.createInterface({
  input: fs.createReadStream(inPath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let rows = 0;
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

for (const arr of byUser.values()) arr.sort((a, b) => a.ts - b.ts);

// Build per-user train/test splits with multiple test points.
/** @type {Map<string, Set<string>>} */
const trainItemsByUser = new Map();
/** @type {Map<string, Array<string>>} */
const testItemsByUser = new Map();

for (const [u, arr] of byUser.entries()) {
  if (arr.length < 2) continue;
  const tp = Math.min(testPoints, Math.max(1, arr.length - 1));
  const test = arr.slice(-tp).map((x) => x.item);
  const train = arr.slice(0, -tp).map((x) => x.item);
  if (train.length < 1 || test.length < 1) continue;
  trainItemsByUser.set(u, new Set(train));
  testItemsByUser.set(u, test);
}

// Popularity counts from train.
/** @type {Map<string, number>} */
const pop = new Map();
for (const trainSet of trainItemsByUser.values()) {
  for (const item of trainSet) pop.set(item, (pop.get(item) ?? 0) + 1);
}

const sortedPopular = [...pop.entries()].sort((a, b) => b[1] - a[1]).map(([item]) => item);
const totalTrainItems = sortedPopular.length;

// Evaluate ranking metrics averaged over users and test points.
let users = 0;
let testTotal = 0;
let hit = 0;
let mrrSum = 0;
let ndcgSum = 0;
let apSum = 0;

const recommended = new Set();

for (const [u, tests] of testItemsByUser.entries()) {
  const seen = trainItemsByUser.get(u);
  if (!seen) continue;
  users += 1;

  // Recommend top-K popular items not already seen.
  const recs = [];
  for (const item of sortedPopular) {
    if (seen.has(item)) continue;
    recs.push(item);
    recommended.add(item);
    if (recs.length >= k) break;
  }

  // Multiple test items: treat each independently (binary relevance).
  for (const testItem of tests) {
    testTotal += 1;
    const idx = recs.indexOf(testItem);
    if (idx !== -1) {
      hit += 1;
      const rank = idx + 1;
      mrrSum += 1 / rank;
      ndcgSum += ndcgAtK(rank, k);
      // AP for single relevant item equals precision@rank
      apSum += 1 / rank;
    }
  }
}

const denom = testTotal || 1;
const hitRate = hit / denom;
const mrr = mrrSum / denom;
const ndcg = ndcgSum / denom;
const map = apSum / denom;
const itemCoverage = totalTrainItems ? recommended.size / totalTrainItems : 0;

console.log("\nOffline ranking eval: Global Popularity (multi-point)");
console.log(`Input rows: ${rows}`);
console.log(`Users evaluated: ${users}`);
console.log(`Test points per user (max): ${testPoints}`);
console.log(`Total test interactions: ${testTotal}`);
console.log(`HitRate@${k}: ${hitRate.toFixed(4)}`);
console.log(`MRR@${k}: ${mrr.toFixed(4)}`);
console.log(`NDCG@${k}: ${ndcg.toFixed(4)}`);
console.log(`MAP@${k}: ${map.toFixed(4)}`);
console.log(`Catalog coverage (over train items): ${itemCoverage.toFixed(4)}`);

console.log("\nNext steps:");
console.log("- Add per-user popularity / co-visitation baselines");
console.log("- Add novelty/diversity metrics using OMDb genres (requires join/export)");
console.log("- Compare experiment variants by slicing on rec_request_id -> request_context.experiments");
