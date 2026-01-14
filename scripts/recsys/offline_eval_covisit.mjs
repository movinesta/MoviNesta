#!/usr/bin/env node
/* eslint-disable no-console */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Offline evaluation for the co-visitation baseline using an exported JSONL of outcomes.
 *
 * Usage:
 *  node scripts/recsys/offline_eval_covisit.mjs --events rec_outcomes.jsonl --model covisit_model.json --k 10
 *
 * Assumptions:
 *  - events JSONL contains {user_id, media_item_id, outcome_type, created_at, rating_0_10?}
 *  - We treat positives as: like, watchlist_add, rating>=7
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

const eventsFile = argValue("--events", path.join(process.cwd(), "rec_outcomes.jsonl"));
const modelFile = argValue("--model", path.join(process.cwd(), "covisit_model.json"));
const K = clamp(argValue("--k", "10"), 1, 100);

const POSITIVE = new Set(["like", "watchlist_add", "rating"]);

function isPositive(e) {
  if (!e?.outcome_type) return false;
  if (e.outcome_type === "rating") {
    const r = Number(e.rating_0_10);
    return Number.isFinite(r) && r >= 7;
  }
  return POSITIVE.has(e.outcome_type);
}

function ndcgAtK(hitRank, k) {
  if (hitRank == null) return 0;
  if (hitRank >= k) return 0;
  // DCG with single relevant item
  return 1 / Math.log2(hitRank + 2);
}

function loadJsonl(fp) {
  const txt = fs.readFileSync(fp, "utf-8");
  const lines = txt.split(/\r?\n/).filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}

function recommend(model, history, k, banned) {
  const scores = new Map();
  for (const it of history) {
    const neigh = model.itemTop?.[it];
    if (!neigh) continue;
    for (const [other, w] of neigh) {
      if (banned.has(other)) continue;
      scores.set(other, (scores.get(other) || 0) + Number(w));
    }
  }
  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, k).map((x) => x[0]);
  return ranked;
}

function main() {
  const model = JSON.parse(fs.readFileSync(modelFile, "utf-8"));
  const events = loadJsonl(eventsFile).filter(isPositive);

  // Group by user, order by time
  const byUser = new Map();
  for (const e of events) {
    if (!e.user_id || !e.media_item_id) continue;
    let arr = byUser.get(e.user_id);
    if (!arr) {
      arr = [];
      byUser.set(e.user_id, arr);
    }
    arr.push(e);
  }
  for (const [, arr] of byUser) {
    arr.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  let usersEval = 0;
  let hits = 0;
  let mrr = 0;
  let ndcg = 0;

  for (const [, arr] of byUser) {
    if (arr.length < 2) continue;
    // leave-one-out: last item is target
    const target = arr[arr.length - 1].media_item_id;
    const histItems = arr.slice(0, -1).map((x) => x.media_item_id);
    const history = Array.from(new Set(histItems.slice(-50))); // last 50 unique positives
    if (!history.length) continue;

    const banned = new Set(history);
    banned.add(target); // allow recommending target? no, we want to see if target appears; so remove from banned
    banned.delete(target);

    const recs = recommend(model, history, K, banned);
    usersEval++;

    const rank = recs.indexOf(target);
    if (rank !== -1) {
      hits++;
      mrr += 1 / (rank + 1);
      ndcg += ndcgAtK(rank, K);
    }
  }

  const hr = usersEval ? hits / usersEval : 0;
  const mrrAvg = usersEval ? mrr / usersEval : 0;
  const ndcgAvg = usersEval ? ndcg / usersEval : 0;

  console.log(JSON.stringify({ usersEval, K, hitRate: hr, mrr: mrrAvg, ndcg: ndcgAvg }, null, 2));
}

main();
