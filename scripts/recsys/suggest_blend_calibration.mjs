#!/usr/bin/env node
/* eslint-disable no-console */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return fallback;
  return next;
}

const imprPath = argValue("--impressions", "./tmp/rec_impressions.jsonl");
const outPath = argValue("--outcomes", "./tmp/rec_outcomes.jsonl");
const outFile = argValue("--out", "./tmp/suggested_source_multipliers.json");

// Multi-objective weighting for calibration. Example:
//   --objective "like:0.6,watchlist:0.3,dwell_long:0.1"
const objectiveSpec = argValue("--objective", "like:0.7,watchlist:0.3");
function parseObjective(spec) {
  const parts = String(spec || "").split(",").map((p) => p.trim()).filter(Boolean);
  const w = {};
  for (const part of parts) {
    const [k, v] = part.split(":");
    const key = String(k || "").trim().toLowerCase();
    const val = Number(v);
    if (!key) continue;
    if (!Number.isFinite(val) || val < 0) continue;
    w[key] = (w[key] ?? 0) + val;
  }
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  if (!sum) return { like: 1 };
  for (const k of Object.keys(w)) w[k] = w[k] / sum;
  return w;
}
const objective = parseObjective(objectiveSpec);


const ALPHA = Number(argValue("--alpha", "0.5")); // shrinkage exponent
const CLAMP_LO = Number(argValue("--min", "0.7"));
const CLAMP_HI = Number(argValue("--max", "1.3"));

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function normSource(s) {
  const x = String(s ?? "").trim().toLowerCase();
  if (!x) return "unknown";
  // normalize common aliases
  if (x === "segpop") return "seg_pop";
  if (x === "for-you") return "for_you";
  return x;
}

async function readJsonl(file, onRow) {
  const abs = path.resolve(process.cwd(), file);
  const input = fs.createReadStream(abs, { encoding: "utf-8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    let row;
    try {
      row = JSON.parse(t);
    } catch {
      continue;
    }
    onRow(row);
    n++;
  }
  return n;
}

const impr = new Map();
const like = new Map();
const wl = new Map();

const dwellLong = new Map();
const watch = new Map();
console.log(`Reading impressions: ${imprPath}`);
const nImpr = await readJsonl(imprPath, (r) => {
  const s = normSource(r?.source);
  impr.set(s, (impr.get(s) ?? 0) + 1);
});

console.log(`Reading outcomes: ${outPath}`);
const nOut = await readJsonl(outPath, (r) => {
  const s = normSource(r?.source);
  const ot = String(r?.outcome_type ?? "").trim().toLowerCase();
  if (ot === "like") like.set(s, (like.get(s) ?? 0) + 1);
  if (ot === "watchlist_add" || ot === "watchlist") wl.set(s, (wl.get(s) ?? 0) + 1);
  if (ot === "dwell_long" || ot === "long_dwell" || ot === "detail_open_long") dwellLong.set(s, (dwellLong.get(s) ?? 0) + 1);
  if (ot === "watch" || ot === "watched" || ot === "complete" || ot === "completed") watch.set(s, (watch.get(s) ?? 0) + 1);
});

const allSources = Array.from(new Set([...impr.keys(), ...like.keys(), ...wl.keys(), ...dwellLong.keys(), ...watch.keys()]));

let totalImpr = 0;
let totalLike = 0;
let totalWl = 0;
let totalDwellLong = 0;
let totalWatch = 0;
for (const s of allSources) {
  totalImpr += impr.get(s) ?? 0;
  totalLike += like.get(s) ?? 0;
  totalWl += wl.get(s) ?? 0;
  totalDwellLong += dwellLong.get(s) ?? 0;
  totalWatch += watch.get(s) ?? 0;
}

const overallLikeRate = totalImpr ? totalLike / totalImpr : 0;
const overallWlRate = totalImpr ? totalWl / totalImpr : 0;
const overallDwellLongRate = totalImpr ? totalDwellLong / totalImpr : 0;
const overallWatchRate = totalImpr ? totalWatch / totalImpr : 0;
const overallObjectiveRate = (objective.like ?? 0) * overallLikeRate + (objective.watchlist ?? 0) * overallWlRate + (objective.dwell_long ?? objective.dwelllong ?? 0) * overallDwellLongRate + (objective.watch ?? 0) * overallWatchRate;

function safeRate(num, den) {
  if (!den) return 0;
  return num / den;
}

// Suggest multipliers by relative objective-rate (multi-metric) with shrinkage.
const suggested = {};
const debugRows = [];

for (const s of allSources.sort()) {
  const i = impr.get(s) ?? 0;
  const l = like.get(s) ?? 0;
  const w = wl.get(s) ?? 0;
  const d = dwellLong.get(s) ?? 0;
  const wa = watch.get(s) ?? 0;
  const lr = safeRate(l, i);
  const wr = safeRate(w, i);
  const dr = safeRate(d, i);
  const war = safeRate(wa, i);
  const objRate = (objective.like ?? 0) * lr + (objective.watchlist ?? 0) * wr + (objective.dwell_long ?? objective.dwelllong ?? 0) * dr + (objective.watch ?? 0) * war;
  // relative ratio vs overall objective (defaults to 1 if overall is ~0)
  let ratio = overallObjectiveRate > 0 ? objRate / overallObjectiveRate : 1;
  // shrink extreme values: ratio^ALPHA (ALPHA=0 => 1.0, ALPHA=1 => full ratio)
  ratio = Math.pow(Math.max(0, ratio), clamp(ALPHA, 0, 1));
  const mult = clamp(ratio, CLAMP_LO, CLAMP_HI);
  suggested[s] = Number(mult.toFixed(3));
  debugRows.push({
    source: s,
    impressions: i,
    likes: l,
    watchlist_adds: w,
      dwell_long: d,
      watch_events: wa,
    like_rate: Number(lr.toFixed(4)),
    watchlist_rate: Number(wr.toFixed(4)),
      dwell_long_rate: Number(dr.toFixed(4)),
      watch_rate: Number(war.toFixed(4)),
      objective_rate: Number(objRate.toFixed(4)),
      objective_weights: objectiveSpec,
    multiplier: Number(mult.toFixed(3)),
  });
}

const payload = {
  generated_at: new Date().toISOString(),
  inputs: {
    impressions_file: path.resolve(process.cwd(), imprPath),
    outcomes_file: path.resolve(process.cwd(), outPath),
    objective: objectiveSpec,
    alpha: ALPHA,
    clamp: [CLAMP_LO, CLAMP_HI],
  },
  overall: {
    impressions: totalImpr,
    likes: totalLike,
    watchlist_adds: totalWl,
    like_rate: Number(overallLikeRate.toFixed(4)),
    watchlist_rate: Number(overallWlRate.toFixed(4)),
    dwell_long_rate: Number(overallDwellLongRate.toFixed(4)),
    watch_rate: Number(overallWatchRate.toFixed(4)),
    objective_weights: objectiveSpec,
    objective_rate: Number(overallObjectiveRate.toFixed(4)),
  },
  suggested_source_multipliers: suggested,
  per_source: debugRows,
  apply_to_setting: {
    key: "ranking.swipe.blend",
    path: "source_multipliers",
    note: "Paste suggested_source_multipliers into ranking.swipe.blend.source_multipliers (server_only), then validate via A/B metrics.",
  },
};

const absOut = path.resolve(process.cwd(), outFile);
fs.mkdirSync(path.dirname(absOut), { recursive: true });
fs.writeFileSync(absOut, JSON.stringify(payload, null, 2));

console.log(`Done. Read ${nImpr} impressions, ${nOut} outcomes.`);
console.log(`Wrote: ${absOut}`);