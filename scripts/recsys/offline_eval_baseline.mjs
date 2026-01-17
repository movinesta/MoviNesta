#!/usr/bin/env node
/* eslint-disable no-console */

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

if (!inPath) {
  console.error("Usage: node scripts/recsys/offline_eval_baseline.mjs --in <file.jsonl> [--k 20]");
  process.exit(1);
}

if (!Number.isFinite(k) || k <= 0 || k > 200) {
  console.error("--k must be between 1 and 200");
  process.exit(1);
}

const abs = inPath;
if (!fs.existsSync(abs)) {
  console.error("Input file not found:", abs);
  process.exit(1);
}

// Define a minimal "positive" interaction set.
// You can tune these based on your business goals.
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

// Read JSONL and collect per-user positives sorted by time.
/** @type {Map<string, Array<{ts:number, item:string}>>} */
const byUser = new Map();

const rl = readline.createInterface({
  input: fs.createReadStream(abs, { encoding: "utf8" }),
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

for (const arr of byUser.values()) {
  arr.sort((a, b) => a.ts - b.ts);
}

// Split per-user: last positive is test, rest train.
/** @type {Map<string, Set<string>>} */
const trainItemsByUser = new Map();
/** @type {Map<string, string>} */
const testItemByUser = new Map();

for (const [u, arr] of byUser.entries()) {
  if (arr.length < 2) continue; // need at least 1 train + 1 test
  const test = arr[arr.length - 1];
  testItemByUser.set(u, test.item);

  const trainSet = new Set(arr.slice(0, -1).map((x) => x.item));
  trainItemsByUser.set(u, trainSet);
}

// Popularity counts from train.
/** @type {Map<string, number>} */
const pop = new Map();
for (const trainSet of trainItemsByUser.values()) {
  for (const item of trainSet) {
    pop.set(item, (pop.get(item) ?? 0) + 1);
  }
}

const sortedPopular = [...pop.entries()].sort((a, b) => b[1] - a[1]).map(([item]) => item);

// Evaluate.
let users = 0;
let hits = 0;
let mrrSum = 0;
const recommended = new Set();

for (const [u, testItem] of testItemByUser.entries()) {
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

  const rank = recs.indexOf(testItem);
  if (rank !== -1) {
    hits += 1;
    mrrSum += 1 / (rank + 1);
  }
}

const hitRate = users ? hits / users : 0;
const mrr = users ? mrrSum / users : 0;
const itemCoverage = sortedPopular.length ? recommended.size / sortedPopular.length : 0;

console.log("\nOffline baseline: Global Popularity");
console.log(`Input rows: ${rows}`);
console.log(`Users evaluated: ${users}`);
console.log(`HitRate@${k}: ${hitRate.toFixed(4)}`);
console.log(`MRR@${k}: ${mrr.toFixed(4)}`);
console.log(`Catalog coverage (over train items): ${itemCoverage.toFixed(4)}`);

console.log("\nNext steps:");
console.log("- Add time-based split per user (multiple test points)");
console.log("- Add ranking metrics: NDCG@K, MAP@K");
console.log("- Add business-aligned metrics: novelty, diversity, long-term engagement proxies");