/**
 * media-swipe-deck (Brain v2) + OPTIONAL Voyage rerank (rerank-2.5)
 *
 * Base behavior (unchanged):
 * - Uses DB RPC: public.media_swipe_deck_v2(session_id, limit, mode, kind_filter, seed)
 * - Returns: { deckId, cards: [...] }
 *
 * Added (non-breaking):
 * - If embedding_settings.rerank_swipe_enabled = true, we rerank the top K candidates
 *   (embedding_settings.rerank_top_k) using Voyage rerank.
 * - Query for rerank:
 *     1) If request includes { rerankQuery: "..." }, we use it.
 *     2) Otherwise, we build a "taste match" query from the user's recent swipe signals
 *        (likes/watchlist/ratings/dwell) for modes: for_you / friends / combined.
 *
 * This keeps reranking at query-time (best practice) and does NOT affect backfill/cron.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { VOYAGE_API_KEY, VOYAGE_RERANK_MODEL } from "../_shared/config.ts";
import { voyageRerank } from "../_shared/voyage.ts";
import { buildRerankDocument, buildTasteQuery, summarizeTasteFromItems } from "../_shared/taste_match.ts";

// Simple in-memory cooldown to avoid hammering Voyage when rate-limited (429).
// Edge functions are stateless across deployments, but this helps within a warm worker.
let VOYAGE_RERANK_COOLDOWN_UNTIL = 0;

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

type RerankRequest = {
  rerank?: boolean;
  rerankQuery?: string;
  // How many *candidates* to send to the reranker.
  // (We keep the rest in base order after the reranked block.)
  rerankTopK?: number;
};

function makeRerankDoc(r: any): string {
  const title = (r.title ?? "").toString().trim();
  const overview = (r.overview ?? "").toString().trim();

  // Keep it short and stable; rerank works best on concise representations.
  if (title && overview) return `${title}\n${overview}`;
  return title || overview || "";
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(n, b));
}

async function loadEmbeddingSettings(client: any): Promise<{ rerank_swipe_enabled: boolean; rerank_top_k: number } | null> {
  try {
    const { data, error } = await client
      .from("embedding_settings")
      .select("rerank_swipe_enabled, rerank_top_k")
      .eq("id", 1)
      .maybeSingle();
    if (error) return null;
    if (!data) return null;
    return {
      rerank_swipe_enabled: Boolean((data as any).rerank_swipe_enabled),
      rerank_top_k: clamp(Number((data as any).rerank_top_k ?? 50), 5, 200),
    };
  } catch {
    return null;
  }
}

async function fetchMediaItemsByIds(client: any, ids: string[]): Promise<any[]> {
  if (!ids.length) return [];
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 500);
  const { data, error } = await client
    .from("media_items")
    .select(
      [
        "id",
        "kind",
        "tmdb_release_date",
        "tmdb_first_air_date",
        "omdb_year",
        "tmdb_overview",
        "omdb_plot",
        "tmdb_original_language",
        "omdb_language",
        "omdb_country",
        "omdb_genre",
        "tmdb_raw",
        "omdb_actors",
        "omdb_director",
        "omdb_writer",
        "omdb_rated",
        "tmdb_title",
        "tmdb_name",
        "omdb_title",
      ].join(","),
    )
    .in("id", unique);

  if (error) return [];
  return (data ?? []) as any[];
}

type TasteEventRow = {
  event_type: string;
  media_item_id: string;
  created_at: string;
  dwell_ms: number | null;
  rating_0_10: number | null;
  in_watchlist: boolean | null;
};

function pickTasteIds(events: TasteEventRow[], opts?: { likedMax?: number; dislikedMax?: number }): { liked: string[]; disliked: string[] } {
  const likedMax = clamp(Number(opts?.likedMax ?? 6), 1, 12);
  const dislikedMax = clamp(Number(opts?.dislikedMax ?? 4), 0, 10);

  const liked: string[] = [];
  const disliked: string[] = [];
  const seenLiked = new Set<string>();
  const seenDisliked = new Set<string>();

  const add = (arr: string[], set: Set<string>, id: string, max: number) => {
    if (!id) return;
    if (set.has(id)) return;
    set.add(id);
    arr.push(id);
    if (arr.length > max) arr.length = max;
  };

  for (const e of events) {
    const et = String(e.event_type ?? "").toLowerCase();
    const id = String(e.media_item_id ?? "");

    const rating = typeof e.rating_0_10 === "number" ? e.rating_0_10 : null;
    const dwell = typeof e.dwell_ms === "number" ? e.dwell_ms : null;

    // Strong positives
    if (et === "like") add(liked, seenLiked, id, likedMax);
    else if (et === "watchlist" && e.in_watchlist === true) add(liked, seenLiked, id, likedMax);
    else if (et === "rating" && rating != null && rating >= 7) add(liked, seenLiked, id, likedMax);
    else if (et === "dwell" && dwell != null && dwell >= 12000) add(liked, seenLiked, id, likedMax);

    // Strong negatives
    if (et === "dislike") add(disliked, seenDisliked, id, dislikedMax);
    else if (et === "rating" && rating != null && rating <= 3) add(disliked, seenDisliked, id, dislikedMax);

    if (liked.length >= likedMax && disliked.length >= dislikedMax) break;
  }

  return { liked, disliked };
}

async function buildTasteQueryForUser(client: any, userId: string): Promise<string> {
  // Pull recent events. This is intentionally bounded to keep it cheap.
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  const { data, error } = await client
    .from("media_events")
    .select("event_type, media_item_id, created_at, dwell_ms, rating_0_10, in_watchlist")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return "";
  const events = (data ?? []) as TasteEventRow[];
  if (!events.length) return "";

  const ids = pickTasteIds(events);
  if (ids.liked.length < 3) return "";

  const items = await fetchMediaItemsByIds(client, [...ids.liked, ...ids.disliked]);
  const byId = new Map(items.map((x: any) => [String(x.id), x]));

  const likedItems = ids.liked.map((id) => byId.get(id)).filter(Boolean) as any[];
  const dislikedItems = ids.disliked.map((id) => byId.get(id)).filter(Boolean) as any[];

  const profile = summarizeTasteFromItems({ liked: likedItems, disliked: dislikedItems });
  return buildTasteQuery(profile);
}

function rerankRowsIfRequested(
  rows: any[],
  rr: RerankRequest,
  makeDoc: (row: any) => string = makeRerankDoc,
): Promise<any[]> | any[] {
  const rerank = Boolean(rr?.rerank);
  const rerankQuery = typeof rr?.rerankQuery === "string" ? rr.rerankQuery.trim() : "";
  const candidateK = rr?.rerankTopK != null ? Math.max(1, Math.min(Number(rr.rerankTopK), 200)) : null;

  if (!rerank || !rerankQuery) return rows;

  // If Voyage key is not set, do not fail the deck; just skip rerank.
  if (!VOYAGE_API_KEY) {
    console.warn("MEDIA_SWIPE_DECK_WARN rerank requested but VOYAGE_API_KEY is missing");
    return rows;
  }

  const now = Date.now();
  if (now < VOYAGE_RERANK_COOLDOWN_UNTIL) {
    console.log("MEDIA_SWIPE_DECK_RERANK_SKIPPED", JSON.stringify({ reason: "cooldown", until: VOYAGE_RERANK_COOLDOWN_UNTIL }));
    return rows;
  }








  // Cost/latency win: only send the first K candidates to the reranker.
  // (Voyage rerank cost grows with number of documents sent.)
  const subset = candidateK ? rows.slice(0, Math.min(candidateK, rows.length)) : rows;
  const rest = subset.length < rows.length ? rows.slice(subset.length) : [];

  const documents = subset.map(makeDoc);

  return (async () => {
    try {
      const { results } = await voyageRerank(rerankQuery, documents, {
        model: VOYAGE_RERANK_MODEL || "rerank-2.5",
        // Ask for scores/ranking for the whole subset.
        topK: documents.length,
        truncation: true,
      });

      if (!results?.length) return rows;

      // Build score map by original index
      const scoreByIdx = new Map<number, number>();
      for (const r of results) {
        if (Number.isFinite(r.index)) scoreByIdx.set(Number(r.index), Number(r.relevance_score));
      }

      // Stable sort:
      // - scored rows first by descending score
      // - then unscored rows in original order
      const scored: Array<{ i: number; s: number }> = [];
      const unscored: number[] = [];

      for (let i = 0; i < subset.length; i++) {
        const s = scoreByIdx.get(i);
        if (typeof s === "number" && Number.isFinite(s)) scored.push({ i, s });
        else unscored.push(i);
      }

      scored.sort((a, b) => b.s - a.s);

      const out: any[] = [];
      for (const x of scored) out.push(subset[x.i]);
      for (const i of unscored) out.push(subset[i]);
      for (const r of rest) out.push(r);

      console.log(
        "MEDIA_SWIPE_DECK_RERANK_OK",
        JSON.stringify({ rerankModel: VOYAGE_RERANK_MODEL || "rerank-2.5", queryLen: rerankQuery.length, in: rows.length, rerankCandidates: subset.length, scored: scored.length }),
      );

      return out;
    } catch (err) {
      const msg = String((err as any)?.message ?? err);
      if (msg.includes("(429)")) {
        // Cool down for 90s to avoid hammering the API when you are RPM-limited.
        VOYAGE_RERANK_COOLDOWN_UNTIL = Date.now() + 90_000;
        console.warn("MEDIA_SWIPE_DECK_WARN rerank 429; enabling cooldown", JSON.stringify({ cooldownMs: 90_000 }));
      }

      console.warn("MEDIA_SWIPE_DECK_WARN rerank failed, returning base order:", msg);
      return rows;
    }
  })();
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

    // Service-role client (if available) for reading global settings and building taste profiles.
    // Always gate behavior on the authenticated user above.
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const svc = SERVICE_KEY
      ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
      : null;

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

    let rows = (data ?? []) as any[];

    // --- Taste-match rerank (server-driven via embedding_settings) ---
    const settingsClient = svc ?? supabase;
    const settings = await loadEmbeddingSettings(settingsClient);
    const skipRerank = Boolean((body as any)?.skipRerank);
    const rerankEnabled = Boolean(settings?.rerank_swipe_enabled) && !skipRerank;
    const rerankTopK = clamp(Number(settings?.rerank_top_k ?? 50), 5, 200);

    const explicitQuery = typeof body.rerankQuery === "string" ? body.rerankQuery.trim() : "";
    const canTasteRerank = mode === "for_you" || mode === "combined" || mode === "friends";

    let rerankQuery = "";
    if (rerankEnabled) {
      rerankQuery = explicitQuery || (canTasteRerank ? await buildTasteQueryForUser(settingsClient, auth.user.id) : "");
    }

    if (rerankEnabled && rerankQuery) {
      // Prebuild richer docs for the reranked block only.
      const candidateIds = rows.slice(0, Math.min(rerankTopK, rows.length)).map((r) => String(r.media_item_id));
      const items = await fetchMediaItemsByIds(settingsClient, candidateIds);
      const byId = new Map(items.map((x: any) => [String(x.id), x]));

      rows = await rerankRowsIfRequested(
        rows,
        {
          rerank: true,
          rerankQuery,
          rerankTopK,
        },
        (row) => {
          const mi = byId.get(String(row.media_item_id));
          return mi ? buildRerankDocument(mi, { titleFallback: row.title ?? undefined }) : makeRerankDoc(row);
        },
      );
    }

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
