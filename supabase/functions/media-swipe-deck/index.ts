/**
 * media-swipe-deck (Brain v2)
 *
 * Uses DB RPC: public.media_swipe_deck_v2(session_id, limit, mode, kind_filter, seed)
 * to return ranked cards based on:
 * - user/session taste vectors
 * - item embeddings
 * - user feedback exclusions
 * - trending boosts
 *
 * Keeps the same response contract the frontend expects:
 * { deckId, cards: [...] }
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

function parseOmdbRuntimeMinutes(omdbRuntime: unknown): number | null {
  if (typeof omdbRuntime !== "string") return null;
  const m = omdbRuntime.match(/(\d+)\s*min/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

type Mode = "for_you" | "friends" | "trending" | "combined";
type Kind = "movie" | "series" | "anime";

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

    const mode = (body.mode ?? "for_you") as Mode;
    const limit = Math.min(Math.max(Number(body.limit ?? 60) || 60, 1), 120);
    const kindFilter = (body.kindFilter ?? null) as Kind | null;

    const sessionId = body.sessionId as string | undefined;
    if (!sessionId) return json(400, { ok: false, code: "MISSING_SESSION" });

    const deckId = randomUuid();
    const seed = body.seed ? String(body.seed) : randomUuid();

    const { data, error } = await supabase.rpc("media_swipe_deck_v2", {
      p_session_id: sessionId,
      p_limit: limit,
      p_mode: mode,
      p_kind_filter: kindFilter,
      p_seed: seed,
    });

    if (error) return json(500, { ok: false, code: "RPC_FAILED", message: error.message });

    const rows = (data ?? []) as any[];

    const cards = rows.map((r) => {
      const releaseDate = r.release_date ?? r.first_air_date ?? null;
      const releaseYear = releaseDate ? Number(String(releaseDate).slice(0, 4)) : null;

      return {
        mediaItemId: r.media_item_id,
        title: r.title ?? null,
        overview: r.overview ?? null,
        kind: r.kind ?? "unknown",
        releaseDate,
        releaseYear,
        runtimeMinutes: parseOmdbRuntimeMinutes(r.omdb_runtime),

        posterUrl: null,
        tmdbPosterPath: r.poster_path ?? null,
        tmdbBackdropPath: r.backdrop_path ?? null,

        tmdbVoteAverage: r.vote_average != null ? Number(r.vote_average) : null,
        tmdbVoteCount: r.vote_count != null ? Number(r.vote_count) : null,
        tmdbPopularity: r.popularity != null ? Number(r.popularity) : null,

        completeness: r.completeness != null ? Number(r.completeness) : null,

        source: r.source ?? mode,
        why: null,
      };
    });

    return json(200, { deckId, cards });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
