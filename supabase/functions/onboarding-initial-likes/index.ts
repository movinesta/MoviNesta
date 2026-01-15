/**
 * onboarding-initial-likes
 *
 * App-side onboarding helper:
 * - Accepts a list of media_item_id UUIDs the user says they like.
 * - Writes 'like' events (deduped) so taste vectors learn immediately.
 * - Best-effort: calls media_update_taste_vectors_v1 for each item.
 * - Best-effort: refreshes user centroids once at the end.
 *
 * Request body:
 * {
 *   sessionId: string,
 *   mediaItemIds: string[],  // 1..20
 *   preferredGenres?: string[], // optional (1..20) persisted to public.recsys_user_prefs
 *   deckId?: string,         // optional (client can keep)
 *   source?: string          // optional tag (default: 'onboarding')
 * }
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

function randomUuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function utcDay(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
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

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId) return json(400, { ok: false, code: "MISSING_SESSION" });

    const deckId = typeof body.deckId === "string" && body.deckId.trim() ? body.deckId.trim() : randomUuid();
    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "onboarding";

    const mediaItemIdsRaw = Array.isArray(body.mediaItemIds) ? body.mediaItemIds : [];
    const mediaItemIds = uniq(mediaItemIdsRaw.map((x: any) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)).slice(0, 20);

    const preferredGenresRaw = Array.isArray(body.preferredGenres) ? body.preferredGenres : [];
    const preferredGenres = uniq(
      preferredGenresRaw.map((x: any) => (typeof x === "string" ? x.trim() : "")).filter(Boolean),
    ).slice(0, 20);

    if (!mediaItemIds.length) return json(400, { ok: false, code: "MISSING_MEDIA_ITEM_IDS" });

    // Best-effort: persist onboarding genre preferences (does not block likes insertion)
    if (preferredGenres.length) {
      try {
        const { data: existing } = await supabase
          .from("recsys_user_prefs")
          .select("preferred_genres")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        const merged = uniq([...(existing?.preferred_genres ?? []), ...preferredGenres]).slice(0, 50);
        await supabase.from("recsys_user_prefs").upsert(
          {
            user_id: auth.user.id,
            preferred_genres: merged,
          },
          { onConflict: "user_id" },
        );
      } catch {
        // ignore
      }
    }

    const day = utcDay();

    const rows = mediaItemIds.map((id, idx) => ({
      user_id: auth.user.id,
      session_id: sessionId,
      deck_id: deckId,
      position: idx,
      media_item_id: id,
      event_type: "like",
      source,
      dwell_ms: null,
      rating_0_10: null,
      in_watchlist: null,
      client_event_id: null,
      payload: { onboarding: true },
      event_day: day,
      dedupe_key: `onb:${day}:${id}`,
    }));

    // Insert events with dedupe.
    const { error: upsertErr } = await supabase
      .from("media_events")
      .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });

    if (upsertErr) {
      return json(500, { ok: false, code: "UPSERT_FAILED", message: upsertErr.message });
    }

    // Best-effort: update taste vectors for each event.
    for (const id of mediaItemIds) {
      try {
        const { error: tasteErr } = await supabase.rpc("media_update_taste_vectors_v1", {
          p_session_id: sessionId,
          p_media_item_id: id,
          p_event_type: "like",
          p_dwell_ms: null,
          p_rating_0_10: null,
          p_in_watchlist: null,
        });
        void tasteErr;
      } catch {
        // ignore
      }
    }

    // Best-effort: refresh centroids (multi-taste) so "for_you" becomes meaningful quickly.
    try {
      const { error: cErr } = await supabase.rpc("media_refresh_user_centroids_v1", {});
      void cErr;
    } catch {
      // ignore
    }

    return json(200, { ok: true, deckId, inserted: rows.length });
  } catch (err) {
    return json(500, {
      ok: false,
      code: "INTERNAL_ERROR",
      message: String((err as any)?.message ?? err),
    });
  }
});
