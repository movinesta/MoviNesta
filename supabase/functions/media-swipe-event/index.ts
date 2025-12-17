/**
 * media-swipe-event (v3, hybrid smart)
 *
 * Goals:
 * - Keep media_events useful but not huge:
 *   - impression: at most 1 per day per user+item (DB unique index)
 *   - dwell: bucket + at most 1 per day per bucket per user+item (DB unique index)
 * - Keep media_feedback compact and up-to-date (handled by DB trigger you already installed)
 * - Support idempotency for all events via clientEventId
 *
 * This function inserts/upserts a single event into public.media_events.
 * Rollups and feedback are maintained inside Postgres via triggers.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const DWELL_MIN_MS = 1200;

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
  // YYYY-MM-DD
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function bucketDwell(ms: number): number {
  // Buckets: 2s, 5s, 12s, 20s (cap)
  if (ms < 3000) return 2000;
  if (ms < 8000) return 5000;
  if (ms < 20000) return 12000;
  return 20000;
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
    const eventType = body.eventType as string | undefined;

    if (!sessionId || !mediaItemId || !eventType) {
      return json(400, { ok: false, code: "MISSING_FIELDS" });
    }

    const day = utcDay();

    let dwellMs: number | null =
      typeof body.dwellMs === "number" && Number.isFinite(body.dwellMs) ? Math.round(body.dwellMs) : null;

    // Bucket + threshold dwell (server-side)
    if (eventType === "dwell" && dwellMs !== null) {
      if (dwellMs < DWELL_MIN_MS) return json(200, { ok: true, ignored: true });
      dwellMs = bucketDwell(dwellMs);
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
      rating_0_10: typeof body.rating0_10 === "number" ? body.rating0_10 : null,
      in_watchlist: typeof body.inWatchlist === "boolean" ? body.inWatchlist : null,
      client_event_id: body.clientEventId ?? null,
      payload: body.payload ?? null,
      event_day: day,
    };

    // 1) Idempotent path: client_event_id
    if (insertRow.client_event_id) {
      const { error } = await supabase
        .from("media_events")
        .upsert(insertRow, {
          onConflict: "user_id,client_event_id",
          ignoreDuplicates: true,
        });

      if (error) return json(500, { ok: false, code: "UPSERT_FAILED", message: error.message });
      return json(200, { ok: true });
    }

    // 2) High-volume telemetry: use dedupe indexes
    if (eventType === "impression") {
      const { error } = await supabase
        .from("media_events")
        .upsert(insertRow, {
          onConflict: "user_id,media_item_id,event_day,event_type",
          ignoreDuplicates: true,
        });

      if (error) return json(500, { ok: false, code: "UPSERT_FAILED", message: error.message });
      return json(200, { ok: true });
    }

    if (eventType === "dwell") {
      const { error } = await supabase
        .from("media_events")
        .upsert(insertRow, {
          onConflict: "user_id,media_item_id,event_day,event_type,dwell_ms",
          ignoreDuplicates: true,
        });

      if (error) return json(500, { ok: false, code: "UPSERT_FAILED", message: error.message });
      return json(200, { ok: true });
    }

    // 3) Explicit events: plain insert
    const { error } = await supabase.from("media_events").insert(insertRow);
    if (error) return json(500, { ok: false, code: "INSERT_FAILED", message: error.message });

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
