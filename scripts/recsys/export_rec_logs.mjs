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
const evPath = path.join(outAbsDir, "media_events.jsonl");

const impStream = fs.createWriteStream(impPath, { flags: "w" });
const outStream = fs.createWriteStream(outPath, { flags: "w" });
const evStream = fs.createWriteStream(evPath, { flags: "w" });

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

function deriveOutcome(ev) {
  const t = String(ev?.event_type ?? "");
  if (!t) return null;

  if (t === "like") {
    return { outcome_type: "like" };
  }

  if (t === "dislike") {
    const action = ev?.payload?.action;
    if (action === "not_interested") return { outcome_type: "not_interested" };
    if (action === "hide") return { outcome_type: "hide" };
    return { outcome_type: "dislike" };
  }

  if (t === "watchlist_add") return { outcome_type: "watchlist_add" };
  if (t === "watchlist_remove") return { outcome_type: "watchlist_remove" };
  if (t === "watchlist") {
    const enabled = Boolean(ev?.in_watchlist);
    return { outcome_type: enabled ? "watchlist_add" : "watchlist_remove" };
  }

  if (t === "rating" || t === "rating_set") {
    const r = ev?.rating_0_10;
    if (r == null) return null;
    const n = Number(r);
    if (!Number.isFinite(n)) return null;
    return { outcome_type: "rating", rating_0_10: n };
  }

  if (t === "dwell") {
    const d = ev?.dwell_ms;
    if (d == null) return null;
    const n = Number(d);
    if (!Number.isFinite(n) || n < 0) return null;
    return { outcome_type: "dwell", dwell_ms: n };
  }

  if (t === "skip") return { outcome_type: "skip" };

  return null;
}

async function exportMediaEventsAndOutcomes() {
  const PAGE = 2000;
  let offset = 0;
  let total = 0;
  let totalOut = 0;

  while (true) {
    const { data, error } = await supabase
      .from("media_events")
      .select(
        "id,user_id,session_id,deck_id,rec_request_id,media_item_id,position,event_type,source,dwell_ms,rating_0_10,in_watchlist,created_at,payload,dedupe_key",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error("media_events export failed:", error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const ev of data) {
      evStream.write(JSON.stringify(ev) + "\n");
      const out = deriveOutcome(ev);
      if (out) {
        outStream.write(
          JSON.stringify({
            id: ev.id,
            rec_request_id: ev.rec_request_id,
            user_id: ev.user_id,
            session_id: ev.session_id,
            deck_id: ev.deck_id,
            media_item_id: ev.media_item_id,
            position: ev.position,
            source: ev.source,
            created_at: ev.created_at,
            payload: ev.payload,
            ...out,
          }) + "\n",
        );
        totalOut += 1;
      }
    }

    total += data.length;
    offset += PAGE;
    if (total % 10000 === 0) console.log(`... media_events: ${total} rows`);
  }

  return { total, totalOut };
}

console.log(`Exporting rec logs since ${since} -> ${outAbsDir}`);

const nImp = await exportTable(
  "rec_impressions_enriched_v1",
  "id,rec_request_id,user_id,session_id,deck_id,media_item_id,position,source,dedupe_key,request_context,created_at",
  impStream,
);

const { total: nEv, totalOut: nOut } = await exportMediaEventsAndOutcomes();

impStream.end();
outStream.end();
evStream.end();

console.log(`Done. Wrote ${nImp} impressions, ${nEv} media_events, and ${nOut} derived outcomes.`);
