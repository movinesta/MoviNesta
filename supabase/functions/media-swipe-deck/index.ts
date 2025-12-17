/**
 * media-swipe-deck (contract v1) — runtime column fix
 *
 * Fixes:
 * - "column media_items.tmdb_runtime does not exist"
 *
 * Your schema does NOT have tmdb_runtime as a dedicated column.
 * We derive runtimeMinutes from omdb_runtime ("122 min") when present.
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

function pickTitle(mi: any): string | null {
  return (mi.tmdb_title ?? mi.tmdb_name ?? mi.omdb_title ?? null) as string | null;
}

function pickOverview(mi: any): string | null {
  return (mi.tmdb_overview ?? mi.omdb_plot ?? null) as string | null;
}

function pickRelease(mi: any): string | null {
  return (mi.tmdb_release_date ?? mi.tmdb_first_air_date ?? null) as string | null;
}

function parseOmdbRuntimeMinutes(omdbRuntime: unknown): number | null {
  if (typeof omdbRuntime !== "string") return null;
  // examples: "122 min", "N/A"
  const m = omdbRuntime.match(/(\d+)\s*min/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
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

    const mode = String(body.mode ?? "for_you");
    const limit = Math.min(Math.max(Number(body.limit ?? 60) || 60, 1), 120);
    const kindFilter = body.kindFilter ? String(body.kindFilter) : null;

    const deckId = randomUuid();

    const selectCols = [
      "id",
      "kind",
      "completeness",
      "tmdb_title",
      "tmdb_name",
      "tmdb_overview",
      "tmdb_release_date",
      "tmdb_first_air_date",
      "tmdb_poster_path",
      "tmdb_backdrop_path",
      "tmdb_vote_average",
      "tmdb_vote_count",
      "tmdb_popularity",
      "omdb_title",
      "omdb_plot",
      "omdb_runtime",
    ].join(",");

    const fetchFallback = async () => {
      let q = supabase
        .from("media_items")
        .select(selectCols)
        .not("tmdb_poster_path", "is", null)
        .order("completeness", { ascending: false, nullsFirst: false })
        .order("tmdb_popularity", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (kindFilter) q = q.eq("kind", kindFilter);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    };

    let items: any[] = [];

    if (mode === "trending") {
      // Try trending scores table; if missing, fallback.
      try {
        const { data: top, error: terr } = await supabase
          .from("media_trending_scores")
          .select("media_item_id, score")
          .order("score", { ascending: false })
          .limit(limit * 3);

        if (terr) throw terr;

        const ids = (top ?? []).map((r: any) => r.media_item_id).filter(Boolean);

        if (ids.length) {
          let iq = supabase
            .from("media_items")
            .select(selectCols)
            .in("id", ids)
            .limit(limit * 3);

          if (kindFilter) iq = iq.eq("kind", kindFilter);

          const { data: got, error: ierr } = await iq;
          if (ierr) throw ierr;

          const byId = new Map<string, any>();
          for (const mi of got ?? []) byId.set(mi.id, mi);

          items = ids.map((id: string) => byId.get(id)).filter(Boolean).slice(0, limit);
        } else {
          items = await fetchFallback();
        }
      } catch (_e) {
        items = await fetchFallback();
      }
    } else {
      items = await fetchFallback();
    }

    const cards = (items ?? []).map((mi: any) => {
      const releaseDate = pickRelease(mi);
      const releaseYear = releaseDate ? Number(String(releaseDate).slice(0, 4)) : null;

      const runtimeMinutes = parseOmdbRuntimeMinutes(mi.omdb_runtime);

      return {
        mediaItemId: mi.id,
        title: pickTitle(mi),
        overview: pickOverview(mi),
        kind: mi.kind ?? "unknown",
        releaseDate,
        releaseYear,
        runtimeMinutes,

        posterUrl: null,
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
