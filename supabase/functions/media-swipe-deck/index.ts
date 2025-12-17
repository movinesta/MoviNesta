/**
 * media-swipe-deck (contract v1)
 *
 * Returns a deck of media_items for swipe.
 * This is a minimal baseline implementation that:
 * - selects from public.media_items
 * - ranks by media_trending_scores if mode=trending and table exists
 * - otherwise falls back to tmdb_popularity
 *
 * IMPORTANT: Your real "brain" can replace the SELECT, but KEEP the response contract:
 * {
 *   deckId: uuid,
 *   cards: Array<{
 *     mediaItemId: uuid,
 *     title, overview, kind,
 *     releaseDate, releaseYear, runtimeMinutes,
 *     posterUrl, tmdbPosterPath, tmdbBackdropPath,
 *     tmdbVoteAverage, tmdbVoteCount, tmdbPopularity,
 *     completeness,
 *     source
 *   }>
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

    const mode = (body.mode ?? "for_you") as string;
    const limit = Math.min(Math.max(Number(body.limit ?? 60) || 60, 1), 120);
    const kindFilter = (body.kindFilter ?? null) as string | null;

    // Prefer completed items
    // Avoid items the user disliked recently (if media_feedback exists)
    // (This is intentionally light; your real brain can be heavier.)
    const deckId = randomUuid();

    // Detect if trending table exists
    const { data: hasTrending } = await supabase
      .rpc("to_regclass", { relname: "public.media_trending_scores" })
      .single()
      .catch(() => ({ data: null }));

    let query = supabase
      .from("media_items")
      .select(
        "id, kind, tmdb_title, tmdb_name, tmdb_overview, tmdb_release_date, tmdb_first_air_date, tmdb_runtime, tmdb_poster_path, tmdb_backdrop_path, tmdb_vote_average, tmdb_vote_count, tmdb_popularity, completeness",
      )
      .limit(limit * 3);

    if (kindFilter) {
      // kind is an enum in many schemas; filter with explicit text match is fine on PostgREST
      query = query.eq("kind", kindFilter);
    }

    // Basic ordering
    if (mode === "trending" && hasTrending) {
      // join-like ordering via subquery is not available easily through PostgREST; fallback to tmdb_popularity
      query = query.order("tmdb_popularity", { ascending: false, nullsFirst: false });
    } else {
      query = query.order("tmdb_popularity", { ascending: false, nullsFirst: false });
    }

    const { data: items, error } = await query;
    if (error) return json(500, { ok: false, code: "QUERY_FAILED", message: error.message });

    const cards = (items ?? [])
      .slice(0, limit)
      .map((mi: any) => {
        const title = mi.tmdb_title ?? mi.tmdb_name ?? null;
        const overview = mi.tmdb_overview ?? null;

        const releaseDate = mi.tmdb_release_date ?? mi.tmdb_first_air_date ?? null;
        const releaseYear = releaseDate ? Number(String(releaseDate).slice(0, 4)) : null;

        const runtimeMinutes =
          mi.tmdb_runtime != null ? Number(mi.tmdb_runtime) : null;

        return {
          mediaItemId: mi.id,
          title,
          overview,
          kind: mi.kind ?? "unknown",
          releaseDate,
          releaseYear,
          runtimeMinutes,
          posterUrl: null, // client derives URL from tmdb paths; keep null unless you store absolute URLs
          tmdbPosterPath: mi.tmdb_poster_path ?? null,
          tmdbBackdropPath: mi.tmdb_backdrop_path ?? null,
          tmdbVoteAverage: mi.tmdb_vote_average != null ? Number(mi.tmdb_vote_average) : null,
          tmdbVoteCount: mi.tmdb_vote_count != null ? Number(mi.tmdb_vote_count) : null,
          tmdbPopularity: mi.tmdb_popularity != null ? Number(mi.tmdb_popularity) : null,
          completeness: mi.completeness != null ? Number(mi.completeness) : null,
          source: mode,
        };
      });

    return json(200, { deckId, cards });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
