// supabase/functions/media-swipe-deck/index.ts
//
// Media-only Swipe Brain v2: unified deck builder.
// Sources: public.media_items (+ media_embeddings, media_trending_scores, follows/media_feedback)
// No use of `titles` table.
//
// Auth: keep verify_jwt enabled (default). Client calls must include Authorization header.
//
// Request (POST JSON):
//  - sessionId?: uuid
//  - mode?: "for_you" | "trending" | "friends" | "combined" (default "for_you")
//  - limit?: number (default 30, max 60)
//  - kind?: "movie" | "series" (optional hard filter)
//  - seed?: string (optional; affects exploration ordering)
//  - debug?: boolean (optional; includes per-card score breakdown)
//
// Response:
//  { ok: true, deckId: uuid, cards: Array<{...}> }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";

const FN_NAME = "media-swipe-deck";

const ReqSchema = z.object({
  sessionId: z.string().uuid().optional().nullable(),
  mode: z.enum(["for_you", "trending", "friends", "combined"]).optional().default("for_you"),
  limit: z.number().int().min(1).max(60).optional().default(30),
  kind: z.enum(["movie", "series"]).optional().nullable(),
  seed: z.string().max(200).optional().nullable(),
  debug: z.boolean().optional().default(false),
});

type Req = z.infer<typeof ReqSchema>;

const VECTOR_DIMS = 1024;

type Prefs = {
  year_min: number;
  year_max: number;
  runtime_min: number;
  runtime_max: number;
  completeness_min: number;
};

type MediaItemRow = {
  id: string;
  kind: string | null;

  tmdb_id: number | null;
  omdb_imdb_id: string | null;

  tmdb_title: string | null;
  tmdb_name: string | null;
  omdb_title: string | null;

  tmdb_overview: string | null;
  omdb_plot: string | null;

  omdb_poster: string | null;
  tmdb_poster_path: string | null;
  tmdb_backdrop_path: string | null;

  tmdb_release_date: string | null;
  tmdb_first_air_date: string | null;

  omdb_runtime: string | null;

  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
  tmdb_popularity: number | null;

  omdb_imdb_rating: string | null;
  omdb_rating_internet_movie_database: string | null;

  tmdb_genre_ids: string[] | null;

  completeness: number | null;
};

type MatchRow = { media_item_id: string; similarity: number };
type TrendingRow = { media_item_id: string; score_72h: number };

type FriendAgg = { count: number; score: number };

type FeedbackRow = {
  media_item_id: string;
  last_action: string | null;
  last_action_at: string | null;
};

function coalesceTitle(r: MediaItemRow): string {
  return (r.tmdb_title ?? r.tmdb_name ?? r.omdb_title ?? "").trim();
}

function coalesceOverview(r: MediaItemRow): string {
  return (r.tmdb_overview ?? r.omdb_plot ?? "").trim();
}

function parseYear(r: MediaItemRow): number | null {
  const d = r.tmdb_release_date ?? r.tmdb_first_air_date;
  if (!d) return null;
  const m = /^(\d{4})/.exec(d);
  return m ? Number(m[1]) : null;
}

function parseRuntimeMinutes(r: MediaItemRow): number | null {
  const s = (r.omdb_runtime ?? "").trim();
  const m = /^(\d+)\s*min/i.exec(s);
  return m ? Number(m[1]) : null;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function ln1p(x: number): number {
  return Math.log(1 + Math.max(0, x));
}

function hoursSince(iso: string | null): number {
  if (!iso) return 1e9;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 1e9;
  return (Date.now() - t) / 3600000;
}

function expHalfLife(ageHours: number, halfLifeHours: number): number {
  return Math.exp(-Math.LN2 * (ageHours / halfLifeHours));
}

function parseVector(v: unknown): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) {
    const nums = v.map((x) => Number(x));
    return nums.length ? nums : null;
  }
  if (typeof v === "string") {
    const inner = v.trim().replace(/^\[/, "").replace(/\]$/, "");
    if (!inner) return null;
    const nums = inner.split(",").map((p) => Number(p.trim()));
    if (nums.some((n) => Number.isNaN(n))) return null;
    return nums;
  }
  return null;
}

function vectorToSqlLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum);
  if (!norm || !Number.isFinite(norm)) return vec;
  return vec.map((x) => x / norm);
}

function addWeighted(a: number[], wa: number, b: number[] | null, wb: number): number[] {
  const out = new Array(a.length);
  if (!b) {
    for (let i = 0; i < a.length; i++) out[i] = a[i] * wa;
    return out;
  }
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) out[i] = a[i] * wa + b[i] * wb;
  return out;
}

function hashToUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

async function loadPrefs(admin: any, userId: string): Promise<Prefs> {
  const defaults: Prefs = {
    year_min: 1980,
    year_max: new Date().getUTCFullYear(),
    runtime_min: 30,
    runtime_max: 240,
    completeness_min: 0.8,
  };

  const { data, error } = await admin
    .from("user_swipe_prefs")
    .select("year_min,year_max,runtime_min,runtime_max,completeness_min")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return defaults;

  return {
    year_min: data.year_min ?? defaults.year_min,
    year_max: data.year_max ?? defaults.year_max,
    runtime_min: data.runtime_min ?? defaults.runtime_min,
    runtime_max: data.runtime_max ?? defaults.runtime_max,
    completeness_min: Number(data.completeness_min ?? defaults.completeness_min),
  };
}

async function loadTasteVectors(admin: any, userId: string, sessionId: string | null): Promise<number[] | null> {
  const { data: u } = await admin
    .from("media_user_vectors")
    .select("taste")
    .eq("user_id", userId)
    .maybeSingle();

  const userVec = parseVector(u?.taste);

  let sessionVec: number[] | null = null;
  if (sessionId) {
    const { data: s } = await admin
      .from("media_session_vectors")
      .select("taste")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .maybeSingle();
    sessionVec = parseVector(s?.taste);
  }

  const goodUser = userVec && userVec.length === VECTOR_DIMS ? userVec : null;
  const goodSess = sessionVec && sessionVec.length === VECTOR_DIMS ? sessionVec : null;

  if (!goodUser && !goodSess) return null;

  if (goodUser && goodSess) return l2Normalize(addWeighted(goodUser, 0.65, goodSess, 0.35));
  return l2Normalize(goodUser ?? goodSess!);
}

async function loadRecentKindPreference(admin: any, userId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await admin
    .from("media_feedback")
    .select("media_item_id,last_action_at,last_action,media_items(kind)")
    .eq("user_id", userId)
    .eq("last_action", "like")
    .gte("last_action_at", since)
    .limit(300);

  if (error || !data || data.length === 0) return 0.5;

  let movie = 0;
  let series = 0;
  for (const row of data as any[]) {
    const k = row?.media_items?.kind ?? null;
    if (k === "movie") movie++;
    else if (k === "series") series++;
  }
  const total = movie + series;
  if (total === 0) return 0.5;
  return movie / total;
}

async function loadSeenAndFeedback(admin: any, userId: string): Promise<{
  recentSeen: Set<string>;
  feedbackById: Map<string, FeedbackRow>;
}> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: ev } = await admin
    .from("media_events")
    .select("media_item_id")
    .eq("user_id", userId)
    .gte("created_at", since)
    .limit(2000);

  const recentSeen = new Set<string>((ev ?? []).map((r: any) => r.media_item_id).filter(Boolean));

  const { data: fb } = await admin
    .from("media_feedback")
    .select("media_item_id,last_action,last_action_at")
    .eq("user_id", userId)
    .limit(5000);

  const feedbackById = new Map<string, FeedbackRow>();
  for (const r of (fb ?? []) as any[]) {
    if (r?.media_item_id) feedbackById.set(r.media_item_id, r);
  }

  return { recentSeen, feedbackById };
}

function computeSeenPenalty(mediaItemId: string, recentSeen: Set<string>, fb: FeedbackRow | undefined): number {
  let penalty = 0;

  if (fb?.last_action) {
    const ageH = hoursSince(fb.last_action_at ?? null);
    if (fb.last_action === "dislike") penalty += 1.5 * expHalfLife(ageH, 4320);
    else if (fb.last_action === "skip") penalty += 0.6 * expHalfLife(ageH, 336);
    else if (fb.last_action === "like") penalty += 0.3 * expHalfLife(ageH, 1440);
  }

  if (recentSeen.has(mediaItemId)) penalty += 0.25;
  return penalty;
}

function computeQuality(r: MediaItemRow): number {
  const voteAvg = clamp01((Number(r.tmdb_vote_average ?? 0) / 10));
  const voteCount = clamp01(ln1p(Number(r.tmdb_vote_count ?? 0)) / ln1p(50000));
  const imdbStr = (r.omdb_imdb_rating ?? r.omdb_rating_internet_movie_database ?? "").toString();
  const imdb = clamp01((Number(imdbStr) || 0) / 10);
  const comp = clamp01(Number(r.completeness ?? 0));
  return 0.35 * voteAvg + 0.25 * voteCount + 0.25 * imdb + 0.15 * comp;
}

function mainGenreKey(r: MediaItemRow): string | null {
  const arr = r.tmdb_genre_ids ?? null;
  if (Array.isArray(arr) && arr.length) return String(arr[0]);
  return null;
}

type Scored = {
  id: string;
  row: MediaItemRow;
  score: number;
  sim: number;
  trend: number;
  friends: number;
  quality: number;
  penalty: number;
  source: "for_you" | "trending" | "friends" | "explore" | "combined";
};

function chooseWhy(s: Scored): string {
  if (s.friends >= 0.65) return "Popular with friends";
  if (s.trend >= 0.70) return "Trending now";
  if (s.sim >= 0.60) return "For your taste";
  if (s.quality >= 0.70) return "Highly rated";
  return "Discover";
}

function buildCard(s: Scored, debug: boolean) {
  const r = s.row;
  const title = coalesceTitle(r);
  const overview = coalesceOverview(r);
  const year = parseYear(r);
  const runtime = parseRuntimeMinutes(r);

  return {
    mediaItemId: r.id,
    kind: r.kind ?? null,

    tmdbId: r.tmdb_id ?? null,
    imdbId: r.omdb_imdb_id ?? null,

    title: title || null,
    overview: overview || null,

    posterUrl: r.omdb_poster ?? null,
    tmdbPosterPath: r.tmdb_poster_path ?? null,
    tmdbBackdropPath: r.tmdb_backdrop_path ?? null,

    releaseYear: year,
    runtimeMinutes: runtime,

    tmdbVoteAverage: r.tmdb_vote_average ?? null,
    tmdbVoteCount: r.tmdb_vote_count ?? null,
    tmdbPopularity: r.tmdb_popularity ?? null,

    completeness: r.completeness ?? null,

    why: chooseWhy(s),
    source: s.source,

    ...(debug ? { debugScore: {
      score: s.score,
      sim: s.sim,
      trend: s.trend,
      friends: s.friends,
      quality: s.quality,
      penalty: s.penalty,
    } } : {}),
  };
}

serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const logCtx: Record<string, unknown> = { fn: FN_NAME };

  try {
    const userClient = getUserClient(req);
    const admin = getAdminClient(req);

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonError("Unauthorized", 401, "UNAUTHORIZED");

    const parsed = await validateRequest(req, (body) => ReqSchema.parse(body ?? {}), { logPrefix: `[${FN_NAME}]` });
    if (parsed.errorResponse) return parsed.errorResponse;
    const input = parsed.data as Req;

    const deckId = crypto.randomUUID();
    logCtx.userId = user.id;
    logCtx.deckId = deckId;
    logCtx.mode = input.mode;

    const prefs = await loadPrefs(admin, user.id);
    const kindFilter = input.kind ?? null;

    const taste = await loadTasteVectors(admin, user.id, input.sessionId ?? null);

    const [{ recentSeen, feedbackById }, pMovie] = await Promise.all([
      loadSeenAndFeedback(admin, user.id),
      loadRecentKindPreference(admin, user.id),
    ]);

    const limit = input.limit;
    const overfetch = Math.max(400, limit * 20);

    let personalMatches: MatchRow[] = [];
    if (taste && (input.mode === "for_you" || input.mode === "combined")) {
      const query_embedding = vectorToSqlLiteral(taste);

      const { data, error } = await admin.rpc("match_media_embeddings", {
        query_embedding,
        match_count: overfetch,
        completeness_min: prefs.completeness_min,
        kind_filter: kindFilter,
        year_min: prefs.year_min,
        year_max: prefs.year_max,
      });

      if (error) log(logCtx, "RPC match_media_embeddings failed", { error: error.message });
      else personalMatches = (data ?? []) as MatchRow[];
    }

    let trending: { media_item_id: string; score_72h: number }[] = [];
    if (input.mode === "trending" || input.mode === "combined" || (!taste && input.mode === "for_you")) {
      const { data, error } = await admin
        .from("media_trending_scores")
        .select("media_item_id,score_72h")
        .order("score_72h", { ascending: false })
        .limit(overfetch);

      if (error) log(logCtx, "Trending select failed", { error: error.message });
      else trending = (data ?? []) as TrendingRow[];
    }

    const friendAgg = new Map<string, FriendAgg>();
    if (input.mode === "friends" || input.mode === "combined") {
      const { data: follows, error } = await admin
        .from("follows")
        .select("followed_id")
        .eq("follower_id", user.id)
        .limit(500);

      if (!error && follows && follows.length) {
        const ids = follows.map((r: any) => r.followed_id).filter(Boolean);

        const { data: likes } = await admin
          .from("media_feedback")
          .select("user_id,media_item_id,last_action,in_watchlist")
          .in("user_id", ids)
          .eq("last_action", "like")
          .limit(5000);

        for (const r of (likes ?? []) as any[]) {
          const mid = r?.media_item_id;
          if (!mid) continue;
          const cur = friendAgg.get(mid) ?? { count: 0, score: 0 };
          cur.count += 1;
          friendAgg.set(mid, cur);
        }

        const { data: wl } = await admin
          .from("media_feedback")
          .select("user_id,media_item_id,in_watchlist")
          .in("user_id", ids)
          .eq("in_watchlist", true)
          .limit(5000);

        for (const r of (wl ?? []) as any[]) {
          const mid = r?.media_item_id;
          if (!mid) continue;
          const cur = friendAgg.get(mid) ?? { count: 0, score: 0 };
          cur.count += 1;
          friendAgg.set(mid, cur);
        }
      }
    }

    const simById = new Map<string, number>();
    for (const m of personalMatches) if (m?.media_item_id) simById.set(m.media_item_id, Number(m.similarity ?? 0));

    const trendById = new Map<string, number>();
    for (const t of trending) if (t?.media_item_id) trendById.set(t.media_item_id, Number(t.score_72h ?? 0));

    const candidateIds = new Set<string>();
    for (const id of simById.keys()) candidateIds.add(id);
    for (const id of trendById.keys()) candidateIds.add(id);
    for (const id of friendAgg.keys()) candidateIds.add(id);

    if (input.mode === "combined" || input.mode === "for_you" || input.mode === "trending") {
      const seed = input.seed ?? `${user.id}:${new Date().toISOString().slice(0, 10)}`;
      const u = hashToUnit(seed);
      const offset = Math.floor(u * 2000);

      const { data: explore, error } = await admin
        .from("media_items")
        .select("id")
        .gte("completeness", prefs.completeness_min)
        .order("tmdb_popularity", { ascending: false })
        .range(offset, offset + 250);

      if (!error) for (const r of (explore ?? []) as any[]) if (r?.id) candidateIds.add(r.id);
    }

    if (candidateIds.size === 0) return jsonResponse({ ok: true, deckId, cards: [] });

    const idsArray = Array.from(candidateIds).slice(0, 1200);

    const { data: items, error: itemsErr } = await admin
      .from("media_items")
      .select([
        "id",
        "kind",
        "tmdb_id",
        "omdb_imdb_id",
        "tmdb_title",
        "tmdb_name",
        "omdb_title",
        "tmdb_overview",
        "omdb_plot",
        "omdb_poster",
        "tmdb_poster_path",
        "tmdb_backdrop_path",
        "tmdb_release_date",
        "tmdb_first_air_date",
        "omdb_runtime",
        "tmdb_vote_average",
        "tmdb_vote_count",
        "tmdb_popularity",
        "omdb_imdb_rating",
        "omdb_rating_internet_movie_database",
        "tmdb_genre_ids",
        "completeness",
      ].join(","))
      .in("id", idsArray);

    if (itemsErr) {
      log(logCtx, "media_items select failed", { error: itemsErr.message });
      return jsonError("Failed to load candidates", 500, "CANDIDATE_LOAD_FAILED");
    }

    const rows = (items ?? []) as MediaItemRow[];

    const filtered: MediaItemRow[] = [];
    for (const r of rows) {
      const comp = Number(r.completeness ?? 0);
      if (comp < prefs.completeness_min) continue;

      if (kindFilter && r.kind !== kindFilter) continue;

      const y = parseYear(r);
      if (y !== null && (y < prefs.year_min || y > prefs.year_max)) continue;

      const rt = parseRuntimeMinutes(r);
      if (rt !== null && (rt < prefs.runtime_min || rt > prefs.runtime_max)) continue;

      if (!coalesceTitle(r)) continue;

      filtered.push(r);
    }

    const maxTrend = Math.max(1e-9, ...Array.from(trendById.values()).map((v) => Math.max(0, v)));
    const friendCounts = Array.from(friendAgg.values()).map((v) => v.count);
    const maxFriend = friendCounts.length ? Math.max(1, ...friendCounts) : 1;

    for (const [id, v] of friendAgg.entries()) {
      v.score = clamp01(ln1p(v.count) / ln1p(maxFriend));
      friendAgg.set(id, v);
    }

    const scored: Scored[] = [];
    for (const r of filtered) {
      const id = r.id;

      const sim = clamp01(Number(simById.get(id) ?? 0));
      const tRaw = Number(trendById.get(id) ?? 0);
      const trend = clamp01(ln1p(Math.max(0, tRaw)) / ln1p(maxTrend));

      const f = friendAgg.get(id);
      const friends = f ? f.score : 0;

      const quality = computeQuality(r);

      const fb = feedbackById.get(id);
      const penalty = computeSeenPenalty(id, recentSeen, fb);

      const inSim = simById.has(id);
      const inTrend = trendById.has(id);

      let source: Scored["source"] = "explore";
      if (input.mode === "trending") source = "trending";
      else if (input.mode === "friends") source = "friends";
      else if (input.mode === "for_you") source = inSim ? "for_you" : (inTrend ? "trending" : "explore");
      else source = "combined";

      const base =
        0.55 * sim +
        0.20 * trend +
        0.10 * friends +
        0.10 * quality +
        0.05 * (inSim ? 0 : 1);

      const score = base - penalty;

      scored.push({ id, row: r, score, sim, trend, friends, quality, penalty, source });
    }

    scored.sort((a, b) => b.score - a.score);

    const genreCap = 5;
    const genreCounts = new Map<string, number>();

    const desiredMovie = kindFilter
      ? (kindFilter === "movie" ? limit : 0)
      : Math.max(Math.floor(limit * 0.3), Math.min(Math.ceil(limit * 0.7), Math.round(limit * pMovie)));

    const selected: Scored[] = [];
    const picked = new Set<string>();
    let movieCount = 0;
    let seriesCount = 0;

    function canPick(r: MediaItemRow): boolean {
      const g = mainGenreKey(r);
      if (g) {
        const c = genreCounts.get(g) ?? 0;
        if (c >= genreCap) return false;
      }
      return true;
    }

    function applyPick(r: MediaItemRow) {
      const g = mainGenreKey(r);
      if (g) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      if (r.kind === "movie") movieCount++;
      else if (r.kind === "series") seriesCount++;
    }

    for (const s of scored) {
      if (selected.length >= limit) break;
      if (picked.has(s.id)) continue;
      if (!canPick(s.row)) continue;

      if (!kindFilter) {
        if (movieCount < desiredMovie && s.row.kind === "series") continue;
        if (movieCount >= desiredMovie && s.row.kind === "movie") continue;
      }

      picked.add(s.id);
      selected.push(s);
      applyPick(s.row);
    }

    if (selected.length < limit) {
      for (const s of scored) {
        if (selected.length >= limit) break;
        if (picked.has(s.id)) continue;
        if (!canPick(s.row)) continue;

        picked.add(s.id);
        selected.push(s);
        applyPick(s.row);
      }
    }

    const cards = selected.map((s) => buildCard(s, input.debug));
    return jsonResponse({ ok: true, deckId, cards });
  } catch (err) {
    log(logCtx, "Unhandled error", { error: String(err?.message ?? err), stack: err?.stack });
    return jsonError("Internal error", 500, "INTERNAL_ERROR");
  }
});
