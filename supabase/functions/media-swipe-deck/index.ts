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

// Optional persistent caching/throttling (recommended). These are best-effort and
// silently fall back to base order if service-role access is not available.
const RERANK_CACHE_TTL_SECONDS = Number(Deno.env.get("RERANK_CACHE_TTL_SECONDS") ?? "600"); // 10m
const RERANK_FRESH_WINDOW_SECONDS = Number(Deno.env.get("RERANK_FRESH_WINDOW_SECONDS") ?? "21600"); // 6h
const RERANK_429_COOLDOWN_SECONDS = Number(Deno.env.get("RERANK_429_COOLDOWN_SECONDS") ?? "300"); // 5m

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

async function countStrongPosSignals(client: any, userId: string): Promise<number> {
  // Cheap cold-start detector:
  // - count strong positive signals in the last 30 days
  // - short-circuit once we hit 3
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  try {
    const { data, error } = await client
      .from("media_events")
      .select("event_type, created_at, dwell_ms, rating_0_10, in_watchlist")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) return 0;
    const events = (data ?? []) as TasteEventRow[];
    let n = 0;
    for (const e of events) {
      if (isStrongPositiveEvent(e)) n++;
      if (n >= 3) return 3;
    }
    return n;
  } catch {
    return 0;
  }
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

type TasteQueryResult = {
  query: string;
  strongPosCount: number;
  lastStrongAt: string | null;
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

function isStrongPositiveEvent(e: TasteEventRow): boolean {
  const et = String(e.event_type ?? "").toLowerCase();
  const rating = typeof e.rating_0_10 === "number" ? e.rating_0_10 : null;
  const dwell = typeof e.dwell_ms === "number" ? e.dwell_ms : null;
  if (et === "like") return true;
  if (et === "watchlist" && e.in_watchlist === true) return true;
  if (et === "rating" && rating != null && rating >= 7) return true;
  if (et === "dwell" && dwell != null && dwell >= 12000) return true;
  return false;
}

async function buildTasteQueryForUser(client: any, userId: string): Promise<TasteQueryResult> {
  // Pull recent events. This is intentionally bounded to keep it cheap.
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  const { data, error } = await client
    .from("media_events")
    .select("event_type, media_item_id, created_at, dwell_ms, rating_0_10, in_watchlist")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return { query: "", strongPosCount: 0, lastStrongAt: null };
  const events = (data ?? []) as TasteEventRow[];
  if (!events.length) return { query: "", strongPosCount: 0, lastStrongAt: null };

  let strongPosCount = 0;
  let lastStrongAt: string | null = null;
  for (const e of events) {
    if (isStrongPositiveEvent(e)) {
      strongPosCount++;
      if (!lastStrongAt) lastStrongAt = e.created_at ?? null;
    }
  }

  const ids = pickTasteIds(events);
  if (ids.liked.length < 3) return { query: "", strongPosCount, lastStrongAt };

  const items = await fetchMediaItemsByIds(client, [...ids.liked, ...ids.disliked]);
  const byId = new Map(items.map((x: any) => [String(x.id), x]));

  const likedItems = ids.liked.map((id) => byId.get(id)).filter(Boolean) as any[];
  const dislikedItems = ids.disliked.map((id) => byId.get(id)).filter(Boolean) as any[];

  const profile = summarizeTasteFromItems({ liked: likedItems, disliked: dislikedItems });

  return {
    query: buildTasteQuery(profile),
    strongPosCount,
    lastStrongAt,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function epochMinute(tsIso: string | null): number {
  if (!tsIso) return 0;
  const t = Date.parse(tsIso);
  if (!Number.isFinite(t)) return 0;
  return Math.floor(t / 60000);
}

function makeRerankCacheKey(args: {
  userId: string;
  mode: Mode;
  seed: string;
  profileVersionMinute: number;
  candidateHash: string;
  kindFilter: Kind | null;
}): string {
  return [
    "rerank",
    "voyage",
    args.userId,
    args.mode,
    args.kindFilter ?? "*",
    args.seed,
    String(args.profileVersionMinute),
    args.candidateHash,
  ].join(":");
}

async function getCachedRerankOrder(
  svc: any | null,
  key: string,
): Promise<string[] | null> {
  if (!svc) return null;
  try {
    const { data, error } = await svc
      .from("media_rerank_cache")
      .select("order_ids, expires_at")
      .eq("key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    const ids = (data as any).order_ids;
    if (Array.isArray(ids)) return ids.map((x) => String(x)).filter(Boolean);
    return null;
  } catch {
    return null;
  }
}

async function putCachedRerankOrder(
  svc: any | null,
  args: { key: string; userId: string; orderIds: string[]; meta?: Record<string, unknown> },
): Promise<void> {
  if (!svc) return;
  try {
    const ttl = clamp(Number(RERANK_CACHE_TTL_SECONDS) || 600, 60, 3600);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    await svc
      .from("media_rerank_cache")
      .upsert({
        key: args.key,
        user_id: args.userId,
        order_ids: args.orderIds,
        meta: args.meta ?? {},
        expires_at: expiresAt,
      }, { onConflict: "key" });
  } catch {
    // ignore
  }
}

function cooldownKey(userId: string): string {
  return `cooldown:voyage_rerank:${userId}`;
}

async function getCooldownUntil(svc: any | null, userId: string): Promise<number> {
  if (!svc) return 0;
  try {
    const { data, error } = await svc
      .from("media_rerank_cache")
      .select("expires_at")
      .eq("key", cooldownKey(userId))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return 0;
    const t = Date.parse((data as any).expires_at);
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

async function setCooldown(svc: any | null, userId: string, seconds: number, reason: string): Promise<void> {
  if (!svc) return;
  try {
    const ttl = clamp(Number(seconds) || 300, 30, 3600);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    await svc
      .from("media_rerank_cache")
      .upsert({
        key: cooldownKey(userId),
        user_id: userId,
        order_ids: [],
        meta: { reason },
        expires_at: expiresAt,
      }, { onConflict: "key" });
  } catch {
    // ignore
  }
}

async function rerankRowsWithVoyage(
  rows: any[],
  args: { rerankQuery: string; rerankTopK: number },
  makeDoc: (row: any) => string = makeRerankDoc,
): Promise<{ outRows: any[]; orderIds: string[]; scored: number; rerankCandidates: number }> {
  const rerankQuery = typeof args?.rerankQuery === "string" ? args.rerankQuery.trim() : "";
  const candidateK = Math.max(1, Math.min(Number(args?.rerankTopK ?? 50), 200));

  if (!rerankQuery) {
    return { outRows: rows, orderIds: [], scored: 0, rerankCandidates: 0 };
  }

  if (!VOYAGE_API_KEY) {
    throw new Error("Missing VOYAGE_API_KEY");
  }

  // Cost/latency win: only send the first K candidates to the reranker.
  const subset = rows.slice(0, Math.min(candidateK, rows.length));
  const rest = subset.length < rows.length ? rows.slice(subset.length) : [];

  const documents = subset.map(makeDoc);
  const { results } = await voyageRerank(rerankQuery, documents, {
    model: VOYAGE_RERANK_MODEL || "rerank-2.5",
    topK: documents.length,
    truncation: true,
  });

  if (!results?.length) {
    return { outRows: rows, orderIds: [], scored: 0, rerankCandidates: subset.length };
  }

  const scoreByIdx = new Map<number, number>();
  for (const r of results) {
    if (Number.isFinite(r.index)) scoreByIdx.set(Number(r.index), Number(r.relevance_score));
  }

  const scored: Array<{ i: number; s: number }> = [];
  const unscored: number[] = [];

  for (let i = 0; i < subset.length; i++) {
    const s = scoreByIdx.get(i);
    if (typeof s === "number" && Number.isFinite(s)) scored.push({ i, s });
    else unscored.push(i);
  }

  scored.sort((a, b) => b.s - a.s);

  const outSubset: any[] = [];
  for (const x of scored) outSubset.push(subset[x.i]);
  for (const i of unscored) outSubset.push(subset[i]);

  const outRows = [...outSubset, ...rest];
  const orderIds = outSubset.map((r) => String(r.media_item_id ?? r.mediaItemId ?? "")).filter(Boolean);

  return { outRows, orderIds, scored: scored.length, rerankCandidates: subset.length };
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

    const requestedMode = (body.mode ?? "for_you") as Mode;
    const limit = Math.min(Math.max(Number(body.limit ?? 60) || 60, 1), 120);
    const kindFilter = (body.kindFilter ?? null) as Kind | null;

    const sessionId = body.sessionId as string | undefined;
    if (!sessionId) return json(400, { ok: false, code: "MISSING_SESSION" });

    const deckId = randomUuid();
    const explicitSeed = typeof body.seed === "string" ? body.seed.trim() : "";

    // Cold-start behavior (app-side): if the user has very few strong positives,
    // "for_you" can feel empty/repetitive. We transparently switch to a mixed
    // deck so the user sees quality content immediately.
    let mode: Mode = requestedMode;
    let seed = explicitSeed || randomUuid();
    if (requestedMode === "for_you" && !Boolean((body as any)?.forceForYou)) {
      const nStrong = await countStrongPosSignals(supabase, auth.user.id);
      if (nStrong < 3) {
        mode = "combined";
        // If the client didn't provide a seed, make one stable per-day to reduce
        // flicker for brand-new users.
        if (!explicitSeed) seed = `cold:${sessionId}:${kindFilter ?? "all"}:${utcDay()}`;
      }
    }

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
    const rerankTopKMax = clamp(Number(settings?.rerank_top_k ?? 50), 5, 200);

    const explicitQuery = typeof body.rerankQuery === "string" ? body.rerankQuery.trim() : "";
    const canTasteRerank = mode === "for_you" || mode === "combined" || mode === "friends";

    let taste: TasteQueryResult = { query: "", strongPosCount: 0, lastStrongAt: null };
    if (rerankEnabled && !explicitQuery && canTasteRerank) {
      taste = await buildTasteQueryForUser(settingsClient, auth.user.id);
    }

    const rerankQuery = explicitQuery || taste.query;

    // Freshness gating: if the user hasn't had a strong taste signal recently, avoid re-calling
    // the reranker on every refresh. We'll still use cached reranks if present.
    const nowMs = Date.now();
    const lastStrongMs = taste.lastStrongAt ? Date.parse(taste.lastStrongAt) : 0;
    const isFresh = Boolean(explicitQuery) || (Number.isFinite(lastStrongMs) && nowMs - lastStrongMs <= clamp(RERANK_FRESH_WINDOW_SECONDS, 0, 7 * 86400) * 1000);

    // Adaptive K: new/low-signal users get a smaller rerank candidate set (cheaper + faster).
    let rerankTopK = rerankTopKMax;
    if (!explicitQuery) {
      if (taste.strongPosCount < 5) rerankTopK = Math.min(rerankTopK, 15);
      else if (taste.strongPosCount < 15) rerankTopK = Math.min(rerankTopK, 25);
      else if (taste.strongPosCount < 40) rerankTopK = Math.min(rerankTopK, 40);
      else rerankTopK = Math.min(rerankTopK, 60);
    } else {
      rerankTopK = Math.min(rerankTopK, 60);
    }
    rerankTopK = clamp(Math.min(rerankTopK, rows.length), 1, 200);

    const canAttemptRerank = rerankEnabled && Boolean(rerankQuery) && rerankTopK >= 1;

    if (canAttemptRerank) {
      // Persistent + in-memory cooldown.
      const cooldownUntil = Math.max(await getCooldownUntil(svc, auth.user.id), VOYAGE_RERANK_COOLDOWN_UNTIL);
      const inCooldown = nowMs < cooldownUntil;

      const candidateIdsForHash = rows.slice(0, Math.min(rerankTopK, rows.length)).map((r) => String(r.media_item_id));
      const candidateHash = await sha256Hex(candidateIdsForHash.join("|"));
      const profileVersionMinute = explicitQuery ? epochMinute(new Date().toISOString()) : epochMinute(taste.lastStrongAt);

      const cacheKey = makeRerankCacheKey({
        userId: auth.user.id,
        mode,
        seed,
        profileVersionMinute,
        candidateHash,
        kindFilter,
      });

      // 1) Cache hit? Apply immediately; do not call Voyage.
      const cached = await getCachedRerankOrder(svc, cacheKey);
      if (cached?.length) {
        const subset = rows.slice(0, Math.min(rerankTopK, rows.length));
        const rest = subset.length < rows.length ? rows.slice(subset.length) : [];
        const byId = new Map(subset.map((r) => [String(r.media_item_id), r]));
        const used = new Set<string>();
        const outSubset: any[] = [];
        for (const id of cached) {
          const rr = byId.get(String(id));
          if (rr && !used.has(id)) {
            used.add(id);
            outSubset.push(rr);
          }
        }
        for (const r of subset) {
          const id = String(r.media_item_id);
          if (!used.has(id)) outSubset.push(r);
        }
        rows = [...outSubset, ...rest];
        console.log("MEDIA_SWIPE_DECK_RERANK_CACHE_HIT", JSON.stringify({ mode, rerankCandidates: subset.length, key: cacheKey.slice(0, 48) + "…" }));
      } else if (inCooldown) {
        console.log("MEDIA_SWIPE_DECK_RERANK_SKIPPED", JSON.stringify({ reason: "cooldown", until: cooldownUntil }));
      } else if (!isFresh && !explicitQuery) {
        console.log("MEDIA_SWIPE_DECK_RERANK_SKIPPED", JSON.stringify({ reason: "stale_profile", lastStrongAt: taste.lastStrongAt }));
      } else {
        // 2) Cache miss + eligible: call Voyage.
        const items = await fetchMediaItemsByIds(settingsClient, candidateIdsForHash);
        const miById = new Map(items.map((x: any) => [String(x.id), x]));

        try {
          const res = await rerankRowsWithVoyage(
            rows,
            { rerankQuery, rerankTopK },
            (row) => {
              const mi = miById.get(String(row.media_item_id));
              return mi ? buildRerankDocument(mi, { titleFallback: row.title ?? undefined }) : makeRerankDoc(row);
            },
          );

          rows = res.outRows;
          console.log(
            "MEDIA_SWIPE_DECK_RERANK_OK",
            JSON.stringify({ rerankModel: VOYAGE_RERANK_MODEL || "rerank-2.5", queryLen: rerankQuery.length, in: rows.length, rerankCandidates: res.rerankCandidates, scored: res.scored, topK: rerankTopK }),
          );

          if (res.orderIds.length) {
            await putCachedRerankOrder(svc, {
              key: cacheKey,
              userId: auth.user.id,
              orderIds: res.orderIds,
              meta: { mode, seed, kindFilter, profileVersionMinute, rerankTopK },
            });
          }
        } catch (err) {
          const msg = String((err as any)?.message ?? err);
          if (msg.includes("(429)")) {
            VOYAGE_RERANK_COOLDOWN_UNTIL = Date.now() + 90_000;
            await setCooldown(svc, auth.user.id, RERANK_429_COOLDOWN_SECONDS, "voyage_429");
            console.warn("MEDIA_SWIPE_DECK_WARN rerank 429; enabling cooldown", JSON.stringify({ cooldownSeconds: RERANK_429_COOLDOWN_SECONDS }));
          }
          console.warn("MEDIA_SWIPE_DECK_WARN rerank failed, returning base order:", msg);
        }
      }
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



    // Best-effort: log ranking features for LTR training.
    // Prefer service-role (bypasses RLS), but fall back to the user client
    // if you have permissive insert policies.
    // This should never block serving a deck.
    {
      const logClient = svc ?? supabase;
      try {
        const featureRows = cards.map((c, idx) => ({
          user_id: auth.user.id,
          session_id: sessionId,
          deck_id: deckId,
          position: idx,
          mode,
          kind_filter: kindFilter,
          source: c.source ?? mode,
          media_item_id: c.mediaItemId,
          features: {
            // deck context
            seed,
            rerank_enabled: rerankEnabled,
            rerank_query_len: rerankQuery ? rerankQuery.length : 0,
            rerank_top_k: rerankTopK,
            // item signals (cheap + useful for baseline models)
            kind: c.kind,
            release_year: c.releaseYear,
            runtime_minutes: c.runtimeMinutes,
            tmdb_vote_average: c.tmdbVoteAverage,
            tmdb_vote_count: c.tmdbVoteCount,
            tmdb_popularity: c.tmdbPopularity,
            completeness: c.completeness,
          },
          label: {},
        }));

        const { error: featErr } = await logClient
          .from("media_rank_feature_log")
          .insert(featureRows, { returning: "minimal" });
        void featErr;
      } catch {
        // ignore
      }
    }

    return json(200, { deckId, cards });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
