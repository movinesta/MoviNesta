/**
 * media-swipe-event — FIX: supabase.rpc(...).catch is not a function
 *
 * supabase.rpc() returns a PostgREST builder (not a Promise), so `.catch()` is invalid.
 * Correct pattern:
 *   const { error } = await supabase.rpc(...);
 *   // ignore error (best-effort)
 *
 * This file assumes you're already using the dedupe_key version for events.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const DWELL_MIN_MS = 1200;

const ALLOWED = new Set([
  "impression",
  "dwell",
  "like",
  "dislike",
  "skip",
  "watchlist",
  "rating",
  "open",
  "seen",
  "share",
]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

function utcDay(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function bucketDwell(ms: number): number {
  if (ms < 3000) return 2000;
  if (ms < 8000) return 5000;
  if (ms < 20000) return 12000;
  return 20000;
}

function normalizeEventType(et: unknown): string | null {
  if (typeof et !== "string") return null;
  const v = et.trim().toLowerCase();
  return ALLOWED.has(v) ? v : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) return json(401, { ok: false, code: "UNAUTHORIZED" });

    const body = await req.json().catch(() => null);
    if (!body) return json(400, { ok: false, code: "BAD_JSON" });

    const sessionId = body.sessionId as string | undefined;
    const mediaItemId = body.mediaItemId as string | undefined;
    const eventType = normalizeEventType(body.eventType);

    if (!sessionId || !mediaItemId || !eventType) {
      return json(400, { ok: false, code: "MISSING_FIELDS_OR_INVALID_TYPE" });
    }

    const day = utcDay();

    const clientEventId = typeof body.clientEventId === "string" && body.clientEventId ? body.clientEventId : null;

    const inWatchlist =
      eventType === "watchlist" && typeof body.inWatchlist === "boolean" ? body.inWatchlist : null;

    const rating0_10 =
      eventType === "rating" && typeof body.rating0_10 === "number" && Number.isFinite(body.rating0_10)
        ? body.rating0_10
        : null;

    if (eventType === "watchlist" && inWatchlist === null) {
      return json(400, { ok: false, code: "WATCHLIST_REQUIRES_VALUE" });
    }
    if (eventType === "rating" && rating0_10 === null) {
      return json(400, { ok: false, code: "RATING_REQUIRES_VALUE" });
    }

    let dwellMs: number | null =
      eventType === "dwell" && typeof body.dwellMs === "number" && Number.isFinite(body.dwellMs)
        ? Math.round(body.dwellMs)
        : null;

    if (eventType === "dwell" && dwellMs !== null) {
      if (dwellMs < DWELL_MIN_MS) return json(200, { ok: true, ignored: true });
      dwellMs = bucketDwell(dwellMs);
    }

    // Compute dedupe_key
    let dedupeKey = "";
    if (clientEventId) {
      dedupeKey = `client:${clientEventId}`;
    } else if (eventType === "impression") {
      dedupeKey = `imp:${day}:${mediaItemId}`;
    } else if (eventType === "dwell") {
      const b = dwellMs ?? 0;
      dedupeKey = `dwell:${day}:${mediaItemId}:${b}`;
    } else if (eventType === "watchlist") {
      dedupeKey = `wl:${day}:${mediaItemId}:${inWatchlist ? 1 : 0}`;
    } else if (eventType === "rating") {
      dedupeKey = `rate:${day}:${mediaItemId}:${String(rating0_10)}`;
    } else {
      dedupeKey = `act:${day}:${mediaItemId}:${eventType}`;
    }

    const insertRow: Record<string, unknown> = {
      user_id: auth.user.id,
      session_id: sessionId,
      deck_id: body.deckId ?? null,
      position: typeof body.position === "number" ? Math.round(body.position) : null,
      media_item_id: mediaItemId,
      event_type: eventType,
      source: body.source ?? null,
      dwell_ms: dwellMs,
      rating_0_10: rating0_10,
      in_watchlist: inWatchlist,
      client_event_id: clientEventId,
      payload: body.payload ?? null,
      event_day: day,
      dedupe_key: dedupeKey,
    };

    const { error } = await supabase
      .from("media_events")
      .upsert(insertRow, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });

    if (error) return json(500, { ok: false, code: "UPSERT_FAILED", message: error.message });

    // Best-effort: update taste vectors. Ignore errors, but DO NOT use `.catch()`.
    try {
      const { error: tasteErr } = await supabase.rpc("media_update_taste_vectors_v1", {
        p_session_id: sessionId,
        p_media_item_id: mediaItemId,
        p_event_type: eventType,
        p_dwell_ms: dwellMs,
        p_rating_0_10: rating0_10,
        p_in_watchlist: inWatchlist,
      });
      // Ignore tasteErr; swipe events must never fail because taste update failed.
      void tasteErr;
    } catch (_e) {
      // ignore
    }

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
