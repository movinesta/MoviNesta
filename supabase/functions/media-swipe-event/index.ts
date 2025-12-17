/**
 * media-swipe-event (v2, smart)
 *
 * Inserts a single event into public.media_events.
 * A DB trigger updates/maintains public.media_feedback (compact memory) automatically.
 *
 * Idempotency:
 * - If client_event_id is provided, we UPSERT on (user_id, client_event_id) and ignore duplicates.
 *
 * Server-side bucketing:
 * - dwell is ignored if dwell_ms < DWELL_MIN_MS.
 *
 * Expected JSON body:
 * {
 *   sessionId: string (uuid),
 *   deckId?: string (uuid),
 *   position?: number,
 *   mediaItemId: string (uuid),
 *   eventType: "impression" | "like" | "dislike" | "skip" | "dwell" | ...,
 *   source?: string,
 *   dwellMs?: number,
 *   rating0_10?: number,
 *   inWatchlist?: boolean,
 *   clientEventId?: string (uuid),
 *   payload?: object
 * }
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

    const dwellMs = typeof body.dwellMs === "number" ? Math.round(body.dwellMs) : null;

    if (eventType === "dwell" && dwellMs !== null && dwellMs < DWELL_MIN_MS) {
      // ignore low-information dwells
      return json(200, { ok: true, ignored: true });
    }

    const insertRow = {
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
    };

    // If client_event_id is present, upsert with ignore duplicates
    if (insertRow.client_event_id) {
      const { error } = await supabase
        .from("media_events")
        .upsert(insertRow, {
          onConflict: "user_id,client_event_id",
          ignoreDuplicates: true,
        });

      if (error) return json(500, { ok: false, code: "INSERT_FAILED", message: error.message });
      return json(200, { ok: true });
    }

    // Otherwise plain insert (legacy clients)
    const { error } = await supabase.from("media_events").insert(insertRow);
    if (error) return json(500, { ok: false, code: "INSERT_FAILED", message: error.message });

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
