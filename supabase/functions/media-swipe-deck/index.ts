/**
 * media-swipe-deck (Brain v3) + OPTIONAL Voyage rerank (rerank-2.5)
 *
 * Base behavior (unchanged):
 * - Uses DB RPC: public.media_swipe_deck_v3(session_id, limit, mode, kind_filter, seed)
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
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCorsPreflight, jsonWithCors } from "../_shared/cors.ts";

import { voyageRerank, VOYAGE_API_KEY } from "../_shared/voyage.ts";
import { buildRerankDocument, buildTasteQuery, summarizeTasteFromItems } from "../_shared/taste_match.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";
import { getDefaultSettingsForScope } from "../_shared/appSettingsSchema.ts";

// Simple in-memory cooldown to avoid hammering Voyage when rate-limited (429).
// Edge functions are stateless across deployments, but this helps within a warm worker.
let VOYAGE_RERANK_COOLDOWN_UNTIL = 0;


function json(req: Request, status: number, body: unknown) {
  return jsonWithCors(req, body, { status });
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
function isUuid(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}


function parseOmdbRuntimeMinutes(omdbRuntime: unknown): number | null {
  if (typeof omdbRuntime !== "string") return null;
  const m = omdbRuntime.match(/(\d+)\s*min/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseOmdbYear(omdbYear: unknown): number | null {
  if (omdbYear == null) return null;
  const s = String(omdbYear).trim();
  if (!s) return null;
  const m = s.match(/(\d{4})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function cleanOmdbPosterUrl(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.toLowerCase() === "n/a") return null;
  return s;
}

function tmdbImageUrl(path: string | null | undefined, size: "w500" | "w780" | "original" = "w500"): string | null {
  if (!path) return null;
  const p0 = String(path).trim();
  if (!p0) return null;
  if (p0.startsWith("http://") || p0.startsWith("https://")) return p0;
  const p = p0.startsWith("/") ? p0 : `/${p0}`;
  return `https://image.tmdb.org/t/p/${size}${p}`;
}


function parseOmdbImdbRating(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  // IMDb is 0..10
  return Math.max(0, Math.min(10, n));
}

function parseOmdbPercent(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

type Mode = "for_you" | "friends" | "trending" | "combined";
type Kind = "movie" | "series" | "anime";

const RequestSchema = z
  .object({
    sessionId: z.string().min(1),
    mode: z.enum(["for_you", "friends", "trending", "combined"]).nullish(),
    limit: z.coerce.number().int().min(1).max(120).nullish(),
    kindFilter: z.enum(["movie", "series", "anime"]).nullish(),
    seed: z.string().nullish(),
    minImdbRating: z.coerce.number().min(0).max(10).nullish(),
    genresAny: z.union([z.array(z.string()), z.string()]).nullish(),
    skipRerank: z.boolean().nullish(),
    forceForYou: z.boolean().nullish(),
    rerank: z.boolean().nullish(),
    rerankQuery: z.string().nullish(),

    // Optional experiment assignments (A/B). When provided by the client, the
    // server may use them to change deck behavior (rerank/diversify/etc.).
    experiments: z.record(z.string(), z.string()).nullish(),

    // Optional explicit diversity toggle (primarily used in tests / debugging).
    diversify: z.boolean().nullish(),
  })
  .passthrough();

const EXP_SWIPE_RERANK = "swipe_rerank_v1";
const EXP_SWIPE_DIVERSITY = "swipe_diversity_v1";
const EXP_SWIPE_MIX = "swipe_mix_v1";
const EXP_SWIPE_CF = "swipe_cf_v1";
const EXP_SWIPE_BLEND = "swipe_blend_v1";

type MixVariant = "control" | "balanced" | "trending_heavy" | "friends_heavy" | "for_you_heavy";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Variant-gated deck composition control.
 *
 * We keep relative order within each source and interleave sources via weighted
 * round-robin. This is intentionally lightweight and non-destructive: it never
 * drops items, it only reorders.
 */
function applyMixVariant<T extends { source?: string | null }>(cards: T[], variant: string): { cards: T[]; applied: boolean } {
  const v = (String(variant || "control") as MixVariant) ?? "control";
  if (!cards?.length) return { cards: cards ?? [], applied: false };
  if (v === "control") return { cards, applied: false };

  const cfgEnabled = (cfg as any)?.enabled;
  if (cfgEnabled === false) return { cards, applied: false };

  // Source weights per variant. Unknown sources fall into "other".
  const weights: Record<string, number> = (() => {
    switch (v) {
      case "balanced":
        return { for_you: 1, friends: 1, trending: 1, combined: 1, cf: 1, seg_pop: 1, other: 1 };
      case "trending_heavy":
        return { trending: 3, for_you: 1, friends: 1, combined: 1, cf: 1, seg_pop: 1, other: 1 };
      case "friends_heavy":
        return { friends: 3, for_you: 1, trending: 1, combined: 1, cf: 1, seg_pop: 1, other: 1 };
      case "for_you_heavy":
        return { for_you: 3, combined: 2, friends: 1, trending: 1, cf: 1, seg_pop: 1, other: 1 };
      default:
        return { for_you: 1, friends: 1, trending: 1, combined: 1, cf: 1, seg_pop: 1, other: 1 };
    }
  })();

  // Bucket cards by source, preserving original order.
  const buckets = new Map<string, T[]>();
  for (const c of cards) {
    const s0 = String((c as any)?.source ?? "").trim();
    const s = s0 ? s0 : "other";
    const key = weights[s] != null ? s : "other";
    const arr = buckets.get(key) ?? [];
    arr.push(c);
    buckets.set(key, arr);
  }

  const keys = Array.from(buckets.keys());
  if (keys.length <= 1) return { cards, applied: false };

  // Weighted round robin: repeatedly pick from the source with highest deficit.
  const picked: T[] = [];
  const desired = new Map<string, number>();
  const consumed = new Map<string, number>();
  const totalWeight = keys.reduce((s, k) => s + (weights[k] ?? 1), 0);
  for (const k of keys) {
    desired.set(k, (weights[k] ?? 1) / totalWeight);
    consumed.set(k, 0);
  }

  while (picked.length < cards.length) {
    // Choose source whose consumed share is most below desired share.
    let bestK: string | null = null;
    let bestScore = -Infinity;
    for (const k of keys) {
      const bucket = buckets.get(k) ?? [];
      if (bucket.length === 0) continue;
      const c = consumed.get(k) ?? 0;
      const share = picked.length ? c / picked.length : 0;
      const target = desired.get(k) ?? 0;
      const deficit = target - share;
      if (deficit > bestScore) {
        bestScore = deficit;
        bestK = k;
      }
    }
    if (!bestK) break;
    const bucket = buckets.get(bestK)!;
    picked.push(bucket.shift()!);
    buckets.set(bestK, bucket);
    consumed.set(bestK, (consumed.get(bestK) ?? 0) + 1);
  }

  // If something went wrong, fall back to the original order.
  if (picked.length !== cards.length) return { cards, applied: false };
  return { cards: picked, applied: true };
}

type BlendVariant =
  | "control"
  | "source_weighted"
  | "cf_boost"
  | "friends_boost"
  | "for_you_boost"
  | "longtail";

/**
 * Variant-gated blending (reordering) using a lightweight score:
 * - position-based relevance proxy
 * - TMDB popularity + vote average
 * - optional CF retrieval_score (if present)
 * - source multipliers per variant
 *
 * This is *non-destructive*: it never drops items, only reorders.
 */
function applyBlendVariant<T extends { source?: string | null; tmdbPopularity?: number | null; tmdbVoteAverage?: number | null; retrieval_score?: number | null }>(
  cards: T[],
  variant: string,
  cfg?: { enabled?: boolean; skip_when_mix_active?: boolean; weights?: any; source_multipliers?: any },
): { cards: T[]; applied: boolean } {
  const v = (String(variant || "control") as BlendVariant) ?? "control";
  if (!cards?.length) return { cards: cards ?? [], applied: false };
  if (v === "control") return { cards, applied: false };

  const cfgEnabled = (cfg as any)?.enabled;
  if (cfgEnabled === false) return { cards, applied: false };

const baseSourceMult: Record<string, number> = {
  for_you: Number((cfg as any)?.source_multipliers?.for_you ?? 1.0),
  combined: Number((cfg as any)?.source_multipliers?.combined ?? 1.0),
  friends: Number((cfg as any)?.source_multipliers?.friends ?? 1.0),
  trending: Number((cfg as any)?.source_multipliers?.trending ?? 1.0),
  cf: Number((cfg as any)?.source_multipliers?.cf ?? 1.0),
  seg_pop: Number((cfg as any)?.source_multipliers?.seg_pop ?? 0.9),
  other: Number((cfg as any)?.source_multipliers?.other ?? 1.0),
};

const sourceMult: Record<string, number> = { ...baseSourceMult };

// Variant-specific nudges multiply the configured calibration multipliers (keeps tuning in admin settings).
if (v === "cf_boost") sourceMult.cf = (sourceMult.cf ?? 1.0) * 1.35;
if (v === "friends_boost") sourceMult.friends = (sourceMult.friends ?? 1.0) * 1.35;
if (v === "source_weighted") {
  sourceMult.for_you = (sourceMult.for_you ?? 1.0) * 1.10;
  sourceMult.friends = (sourceMult.friends ?? 1.0) * 1.08;
  sourceMult.cf = (sourceMult.cf ?? 1.0) * 1.12;
}


  const N = cards.length;
  const scored = cards.map((c, i) => {
    const s0 = String((c as any)?.source ?? "").trim();
    const src = s0 || "other";
    const mult = sourceMult[src] ?? sourceMult.other ?? 1.0;

    const pop = Number((c as any)?.tmdbPopularity ?? 0);
    const popNorm = Number.isFinite(pop) ? clamp01(pop / 250) : 0; // TMDB popularity is usually < 250 for most items
    const vote = Number((c as any)?.tmdbVoteAverage ?? 0);
    const voteNorm = Number.isFinite(vote) ? clamp01(vote / 10) : 0;

    const cfRaw = Number((c as any)?.retrieval_score ?? 0);
    const cfNorm = Number.isFinite(cfRaw) ? clamp01(1 - Math.exp(-Math.abs(cfRaw))) : 0;

    const rel = N > 1 ? 1 - i / (N - 1) : 1;

const wPos = Number((cfg as any)?.weights?.position ?? 1.0);
const wPop = Number((cfg as any)?.weights?.popularity ?? 0.25);
const wVote = Number((cfg as any)?.weights?.vote_avg ?? 0.15);
const wCf = Number((cfg as any)?.weights?.cf_score ?? 1.0);

// Normalize weights to a roughly stable scale (avoid exploding scores).
const wSum = Math.max(0.0001, wPos + wPop + wVote + wCf);
const wp = wPos / wSum;
const wpop = wPop / wSum;
const wv = wVote / wSum;
const wcf = wCf / wSum;

let base = wp * rel + wv * voteNorm + wpop * popNorm + wcf * cfNorm;

if (v === "longtail") {
  // Flip popularity contribution: novelty proxy.
  base = wp * rel + wv * voteNorm + wpop * (1 - popNorm) + wcf * cfNorm;
}


    return { c, i, score: base * mult };
  });

  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return { cards: scored.map((x) => x.c), applied: true };
}

function normalizeExperiments(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as any)) {
    const key = typeof k === "string" ? k.trim() : "";
    const val = typeof v === "string" ? v.trim() : "";
    if (!key || !val) continue;
    out[key] = val;
  }
  return out;
}


type VariantSpec = { name: string; weight: number };

function parseVariantsJson(variantsJson: any): VariantSpec[] {
  // Expect JSON array: [{name, weight}], but be defensive.
  if (!Array.isArray(variantsJson)) return [{ name: "control", weight: 1 }];
  const variants: VariantSpec[] = [];
  for (const v of variantsJson) {
    const name = typeof v?.name === "string" ? v.name : null;
    const weight = Number(v?.weight);
    if (!name) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    variants.push({ name, weight });
  }
  return variants.length ? variants : [{ name: "control", weight: 1 }];
}

async function stableUnitInterval(key: string): Promise<number> {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  // Use first 8 bytes -> uint64 -> [0,1)
  let x = 0n;
  for (let i = 0; i < 8; i++) x = (x << 8n) | BigInt(bytes[i]);
  const max = 2n ** 64n;
  return Number(x) / Number(max);
}

async function chooseVariant(userId: string, expKey: string, salt: string, variantsJson: any): Promise<string> {
  const variants = parseVariantsJson(variantsJson);
  const total = variants.reduce((s, v) => s + v.weight, 0);
  const u = await stableUnitInterval(`${userId}|${expKey}|${salt}`);
  let t = u * total;
  for (const v of variants) {
    t -= v.weight;
    if (t <= 0) return v.name;
  }
  return variants[variants.length - 1].name;
}

async function assignExperimentsServerSide(
  svc: any,
  userId: string,
  keys: string[],
): Promise<Record<string, string>> {
  // Best-effort: never throw; return {} on any failure.
  try {
    const { data: exps, error: expErr } = await svc
      .from("rec_experiments")
      .select("id,key,variants,salt,status")
      .in("key", keys)
      .eq("status", "active");

    if (expErr || !exps?.length) return {};

    const assignments: Record<string, string> = {};

    for (const exp of exps) {
      if (!exp?.id || !exp?.key) continue;

      // Existing assignment?
      const { data: existing, error: existingErr } = await svc
        .from("rec_user_experiment_assignments")
        .select("variant")
        .eq("experiment_id", exp.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingErr && existing?.variant) {
        assignments[exp.key] = existing.variant;
        continue;
      }

      const salt = typeof exp.salt === "string" ? exp.salt : "";
      const variant = await chooseVariant(userId, exp.key, salt, exp.variants);

      // Write assignment (idempotent)
      const { error: upErr } = await svc
        .from("rec_user_experiment_assignments")
        .upsert({ experiment_id: exp.id, user_id: userId, variant }, { onConflict: "experiment_id,user_id" });

      if (!upErr) assignments[exp.key] = variant;
    }

    return assignments;
  } catch {
    return {};
  }
}


function toTokensCsv(value: unknown): string[] {
  if (value == null) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a.map((x) => x.toLowerCase()));
  const B = new Set(b.map((x) => x.toLowerCase()));
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function cardSimilarity(a: any, b: any): number {
  // Similarity proxy (0..1) using cheap metadata.
  // We intentionally avoid embeddings here to keep the experiment lightweight.
  const genresA = Array.isArray(a?.genres) ? a.genres : [];
  const genresB = Array.isArray(b?.genres) ? b.genres : [];
  const genreSim = jaccard(genresA, genresB);

  const actorsA = toTokensCsv(a?.actors);
  const actorsB = toTokensCsv(b?.actors);
  const actorSim = jaccard(actorsA, actorsB);

  const dirA = typeof a?.director === "string" ? a.director.trim().toLowerCase() : "";
  const dirB = typeof b?.director === "string" ? b.director.trim().toLowerCase() : "";
  const dirSim = dirA && dirB && dirA === dirB ? 1 : 0;

  const sim = 0.5 * genreSim + 0.3 * actorSim + 0.2 * dirSim;
  return Math.max(0, Math.min(1, sim));
}

function mmrDiversify<T extends any[]>(items: T, opts?: { topN?: number; lambda?: number }): T {
  const topN = clamp(Number(opts?.topN ?? 40), 5, 120);
  const lambda = clamp(Number(opts?.lambda ?? 0.7), 0, 1);
  if (!Array.isArray(items) || items.length <= 2) return items;
  const N = Math.min(topN, items.length);
  const pool = items.slice(0, N);
  const rest = items.slice(N);

  // Relevance proxy: earlier items are "more relevant".
  const rel = pool.map((_, i) => (N - i) / N);

  const selectedIdx: number[] = [];
  const remainingIdx = new Set<number>(Array.from({ length: pool.length }, (_, i) => i));

  // Seed with the most relevant item.
  selectedIdx.push(0);
  remainingIdx.delete(0);

  while (remainingIdx.size) {
    let bestI = -1;
    let bestScore = -Infinity;

    for (const i of remainingIdx) {
      let maxSim = 0;
      for (const j of selectedIdx) {
        const sim = cardSimilarity(pool[i], pool[j]);
        if (sim > maxSim) maxSim = sim;
      }
      const score = lambda * rel[i] - (1 - lambda) * maxSim;
      if (score > bestScore) {
        bestScore = score;
        bestI = i;
      }
    }

    if (bestI === -1) break;
    selectedIdx.push(bestI);
    remainingIdx.delete(bestI);
  }

  const out = selectedIdx.map((i) => pool[i]);
  return [...out, ...rest] as T;
}

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

function isStatementTimeout(error: unknown): boolean {
  const message = String((error as any)?.message ?? "").toLowerCase();
  return message.includes("statement timeout");
}

async function countStrongPosSignals(
  client: any,
  userId: string,
  opts?: { lookbackDays?: number; shortCircuitAt?: number; eventLimit?: number; thresholds?: Partial<TasteThresholds> },
): Promise<number> {
  // Cheap cold-start detector:
  // - count strong positive signals in the last N days
  // - short-circuit once we hit shortCircuitAt
  const lookbackDays = Math.max(1, Math.min(180, Math.floor(Number(opts?.lookbackDays ?? 30))));
  const shortCircuitAt = Math.max(0, Math.min(20, Math.floor(Number(opts?.shortCircuitAt ?? 3))));
  const eventLimit = clamp(Number(opts?.eventLimit ?? 120) || 120, 10, 300);
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * lookbackDays).toISOString();

  try {
    const { data, error } = await client
      .from("media_events")
      .select("event_type, created_at, dwell_ms, rating_0_10, in_watchlist")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(eventLimit);

    if (error) return 0;

    const events = (data ?? []) as TasteEventRow[];
    let n = 0;
    for (const e of events) {
      if (isStrongPositiveEvent(e, opts?.thresholds)) n++;
      if (shortCircuitAt > 0 && n >= shortCircuitAt) break;
    }
    return n;
  } catch {
    return 0;
  }
}

async function loadEmbeddingSettings(client: any): Promise<{ rerank_swipe_enabled: boolean; rerank_top_k: number } | null> {
  // Prefer security-definer RPC so restrictive / RESTRICTIVE RLS on embedding_settings
  // can't break deck serving.
  try {
    const { data, error } = await client.rpc("get_embedding_settings_v1", {});
    if (!error && data) {
      return {
        rerank_swipe_enabled: Boolean((data as any).rerank_swipe_enabled),
        rerank_top_k: clamp(Number((data as any).rerank_top_k ?? 50), 5, 200),
      };
    }
  } catch {
    // ignore
  }

  // Fallback: direct table read (works only if RLS allows it).
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

async function fetchMediaItemsByIds(client: any, ids: string[], opts?: { cap?: number }): Promise<any[]> {
  if (!ids.length) return [];
  const cap = clamp(Number(opts?.cap ?? 500) || 500, 50, 1000);
  const unique = [...new Set(ids.filter(Boolean))].slice(0, cap);

  const { data, error } = await client
    .from("media_items")
    .select(
      [
        "id",
        "kind",
        "omdb_type",
        "tmdb_release_date",
        "tmdb_first_air_date",
        "omdb_year",
        "tmdb_overview",
        "tmdb_poster_path",
        "tmdb_backdrop_path",
        "omdb_plot",
        "tmdb_original_language",
        "omdb_language",
        "omdb_country",
        "omdb_genre",
        "omdb_runtime",
        "omdb_poster",
        "omdb_imdb_rating",
        "omdb_imdb_votes",
        "omdb_rating_rotten_tomatoes",
        "omdb_metascore",
        "omdb_released",
        "omdb_awards",
        "omdb_box_office",
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

type TasteThresholds = {
  strong_positive_rating_min: number;
  strong_negative_rating_max: number;
  strong_positive_dwell_ms_min: number;
};

type TasteSettings = {
  lookback_days: number;
  event_limit: number;
  pick_liked_max: number;
  pick_disliked_max: number;
  min_liked_for_query: number;
  thresholds: TasteThresholds;
};

function pickTasteIds(
  events: TasteEventRow[],
  opts?: { likedMax?: number; dislikedMax?: number; thresholds?: Partial<TasteThresholds> },
): { liked: string[]; disliked: string[] } {
  const likedMax = clamp(Number(opts?.likedMax ?? 6), 1, 12);
  const dislikedMax = clamp(Number(opts?.dislikedMax ?? 4), 0, 10);

  const th: TasteThresholds = {
    strong_positive_rating_min: clamp(Number(opts?.thresholds?.strong_positive_rating_min ?? 7), 0, 10),
    strong_negative_rating_max: clamp(Number(opts?.thresholds?.strong_negative_rating_max ?? 3), 0, 10),
    strong_positive_dwell_ms_min: clamp(Number(opts?.thresholds?.strong_positive_dwell_ms_min ?? 12000), 0, 600_000),
  };

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
    else if (et === "rating" && rating != null && rating >= th.strong_positive_rating_min) add(liked, seenLiked, id, likedMax);
    else if (et === "dwell" && dwell != null && dwell >= th.strong_positive_dwell_ms_min) add(liked, seenLiked, id, likedMax);

    // Strong negatives
    if (et === "dislike") add(disliked, seenDisliked, id, dislikedMax);
    else if (et === "rating" && rating != null && rating <= th.strong_negative_rating_max) add(disliked, seenDisliked, id, dislikedMax);

    if (liked.length >= likedMax && disliked.length >= dislikedMax) break;
  }

  return { liked, disliked };
}

function isStrongPositiveEvent(e: TasteEventRow, thresholds?: Partial<TasteThresholds>): boolean {
  const th: TasteThresholds = {
    strong_positive_rating_min: clamp(Number(thresholds?.strong_positive_rating_min ?? 7), 0, 10),
    strong_negative_rating_max: clamp(Number(thresholds?.strong_negative_rating_max ?? 3), 0, 10),
    strong_positive_dwell_ms_min: clamp(Number(thresholds?.strong_positive_dwell_ms_min ?? 12000), 0, 600_000),
  };

  const et = String(e.event_type ?? "").toLowerCase();
  const rating = typeof e.rating_0_10 === "number" ? e.rating_0_10 : null;
  const dwell = typeof e.dwell_ms === "number" ? e.dwell_ms : null;
  if (et === "like") return true;
  if (et === "watchlist" && e.in_watchlist === true) return true;
  if (et === "rating" && rating != null && rating >= th.strong_positive_rating_min) return true;
  if (et === "dwell" && dwell != null && dwell >= th.strong_positive_dwell_ms_min) return true;
  return false;
}

async function buildTasteQueryForUser(
  client: any,
  userId: string,
  cfg?: Partial<TasteSettings>,
  tasteMatchCfg?: any,
): Promise<TasteQueryResult> {
  // Pull recent events. This is intentionally bounded to keep it cheap.
  const lookbackDays = clamp(Number(cfg?.lookback_days ?? 30), 1, 180);
  const eventLimit = clamp(Number(cfg?.event_limit ?? 250), 50, 1000);
  const pickLikedMax = clamp(Number(cfg?.pick_liked_max ?? 6), 1, 12);
  const pickDislikedMax = clamp(Number(cfg?.pick_disliked_max ?? 4), 0, 10);
  const minLikedForQuery = clamp(Number(cfg?.min_liked_for_query ?? 3), 1, 12);
  const thresholds = (cfg?.thresholds ?? {}) as Partial<TasteThresholds>;

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * lookbackDays).toISOString();
  const { data, error } = await client
    .from("media_events")
    .select("event_type, media_item_id, created_at, dwell_ms, rating_0_10, in_watchlist")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(eventLimit);

  if (error) return { query: "", strongPosCount: 0, lastStrongAt: null };
  const events = (data ?? []) as TasteEventRow[];
  if (!events.length) return { query: "", strongPosCount: 0, lastStrongAt: null };

  let strongPosCount = 0;
  let lastStrongAt: string | null = null;
  for (const e of events) {
    if (isStrongPositiveEvent(e, thresholds)) {
      strongPosCount++;
      if (!lastStrongAt) lastStrongAt = e.created_at ?? null;
    }
  }

  const ids = pickTasteIds(events, {
    likedMax: pickLikedMax,
    dislikedMax: pickDislikedMax,
    thresholds,
  });

  if (ids.liked.length < minLikedForQuery) return { query: "", strongPosCount, lastStrongAt };

  const items = await fetchMediaItemsByIds(client, [...ids.liked, ...ids.disliked]);
  const byId = new Map(items.map((x: any) => [String(x.id), x]));

  const likedItems = ids.liked.map((id) => byId.get(id)).filter(Boolean) as any[];
  const dislikedItems = ids.disliked.map((id) => byId.get(id)).filter(Boolean) as any[];

  const profile = summarizeTasteFromItems({ liked: likedItems, disliked: dislikedItems }, (tasteMatchCfg as any)?.summarize);

  return {
    query: buildTasteQuery(profile, (tasteMatchCfg as any)?.query_caps),
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
  client: any,
  key: string,
): Promise<string[] | null> {
  try {
    const { data, error } = await client
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
  client: any,
  args: { key: string; userId: string; orderIds: string[]; meta?: Record<string, unknown>; ttlSeconds?: number },
): Promise<void> {
  try {
    const ttl = clamp(Number(args.ttlSeconds ?? 600) || 600, 60, 3600);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    await client
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

async function getCooldownUntil(client: any, userId: string): Promise<number> {
  try {
    const { data, error } = await client
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

async function setCooldown(client: any, userId: string, seconds: number, reason: string): Promise<void> {
  try {
    const ttl = clamp(Number(seconds) || 300, 30, 3600);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    await client
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
  args: { rerankQuery: string; rerankTopK: number; rerankModel?: string },
  makeDoc: (row: any) => string = makeRerankDoc,
): Promise<{ outRows: any[]; orderIds: string[]; scored: number; rerankCandidates: number }> {
  const rerankQuery = typeof args?.rerankQuery === "string" ? args.rerankQuery.trim() : "";
  const candidateK = Math.max(1, Math.min(Number(args?.rerankTopK ?? 50), 200));

  if (!rerankQuery) {
    return { outRows: rows, orderIds: [], scored: 0, rerankCandidates: 0 };
  }

  if (!VOYAGE_API_KEY) {
    console.warn("MEDIA_SWIPE_DECK_WARN rerank skipped: missing VOYAGE_API_KEY");
    return { outRows: rows, orderIds: [], scored: 0, rerankCandidates: 0 };
  }

  // Cost/latency win: only send the first K candidates to the reranker.
  const subset = rows.slice(0, Math.min(candidateK, rows.length));
  const rest = subset.length < rows.length ? rows.slice(subset.length) : [];

  const documents = subset.map(makeDoc);
  const { results } = await voyageRerank(rerankQuery, documents, {
    model: (args.rerankModel ?? "rerank-2.5"),
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
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json(req, 500, {
        ok: false,
        code: "CONFIG_MISSING",
        message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY",
      });
    }
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
    if (authErr || !auth?.user) return json(req, 401, { ok: false, code: "UNAUTHORIZED" });


    // Load server-only, admin-controlled tuning knobs (best-effort).
    // NOTE: These settings are only readable via the service-role client.
    let serverOnly: Record<string, unknown> = getDefaultSettingsForScope("server_only");
    if (svc) {
      try {
        const env = await loadAppSettingsForScopes(svc as any, ["server_only"], { cacheTtlMs: 60_000 });
        serverOnly = (env.settings ?? {}) as any;
      } catch {
        // ignore
      }
    }
    // Server-only tuning knobs (non-secret). Values are validated + defaulted by the settings registry.
    const deckCfg = (serverOnly as any)["ranking.swipe.deck"] as any;
    const blendCfg = (serverOnly as any)["ranking.swipe.blend"] as any;
    const tasteCfg = (serverOnly as any)["ranking.swipe.taste"] as any;
    const tasteMatchCfg = (serverOnly as any)["ranking.swipe.taste_match"] as any;
    const adaptiveTopkCfg = (serverOnly as any)["ops.rerank.adaptive_topk"] as any;
    const coldStartEventLimit = clamp(
      Number((serverOnly as any)["ranking.swipe.cold_start.event_limit"] ?? 120) || 120,
      10,
      300,
    );
    const tasteThresholds = (tasteCfg?.thresholds ?? {}) as any;
    
    // Rerank caching/cooldown knobs (admin-controlled server-only settings).
    // These values are validated + defaulted by the settings registry (no env overrides).
    const rerankModel = String((serverOnly as any)["ml.rerank.model"] ?? "rerank-2.5").trim() || "rerank-2.5";
    
    const rerankCacheTtlSeconds = clamp(
      Number((serverOnly as any)["ops.rerank.cache_ttl_seconds"] ?? 600),
      60,
      3600,
    );
    const rerankFreshWindowSeconds = clamp(
      Number((serverOnly as any)["ops.rerank.fresh_window_seconds"] ?? 21600),
      0,
      7 * 86400,
    );
    const rerankCooldown429Seconds = clamp(
      Number((serverOnly as any)["ops.rerank.cooldown_429_seconds"] ?? 300),
      30,
      3600,
    );
    // Cold-start knobs
    const coldStartLookbackDays = clamp(
      Number((serverOnly as any)["ranking.swipe.cold_start.lookback_days"] ?? 30),
      1,
      180,
    );
    const coldStartMinStrong = clamp(
      Number((serverOnly as any)["ranking.swipe.cold_start.min_strong_positive"] ?? 3),
      0,
      20,
    );

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) return json(req, 400, { ok: false, code: "BAD_JSON" });

    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return json(req, 400, { ok: false, code: "BAD_INPUT", message: "Invalid request body" });
    }
    const body = parsed.data;

    // Optional A/B assignments passed from the client (best-effort).
    // These should be treated as advisory; if missing we simply run defaults.
    const clientExperiments = normalizeExperiments((body as any).experiments);

// Server-side assignment fallback (authoritative when service-role client exists).
// This prevents clients from forging variants and ensures A/B is stable even if the app
// doesn't send assignments (e.g., first request, cache miss).
let experiments = clientExperiments;
if (svc) {
  const serverAssignments = await assignExperimentsServerSide(
    svc,
    auth.user.id,
    [EXP_SWIPE_RERANK, EXP_SWIPE_DIVERSITY, EXP_SWIPE_MIX, EXP_SWIPE_CF, EXP_SWIPE_BLEND],
  );
  experiments = { ...clientExperiments, ...serverAssignments };
}

const rerankVariant = experiments[EXP_SWIPE_RERANK] ?? "control";
const diversityVariant = experiments[EXP_SWIPE_DIVERSITY] ?? "control";
const mixVariant = experiments[EXP_SWIPE_MIX] ?? "control";
const cfVariant = experiments[EXP_SWIPE_CF] ?? "off";
const blendVariant = experiments[EXP_SWIPE_BLEND] ?? "control";

    const requestedMode = (body.mode ?? "for_you") as Mode;

    const maxLimit = clamp(Number(deckCfg?.max_limit ?? 120) || 120, 1, 120);
    const defaultLimit = clamp(Number(deckCfg?.default_limit ?? 60) || 60, 1, maxLimit);
    const limit = clamp(Number(body.limit ?? defaultLimit) || defaultLimit, 1, maxLimit);
    const kindFilter = (body.kindFilter ?? null) as Kind | null;

    // Optional server-side filters (best-effort; if missing fields we keep items)
    const minImdbRaw = body.minImdbRating;
    const minImdbRating = Number.isFinite(Number(minImdbRaw))
      ? clamp(Number(minImdbRaw), 0, 10)
      : null;

    const genresAnyRaw = body.genresAny;
    let genresAny: string[] | null = null;
    if (Array.isArray(genresAnyRaw)) {
      const cleaned = genresAnyRaw
        .map((g: any) => String(g ?? "").trim())
        .filter((g: string) => g.length)
        .slice(0, 20);
      genresAny = cleaned.length ? cleaned : null;
    } else if (typeof genresAnyRaw === "string" && genresAnyRaw.trim()) {
      genresAny = [genresAnyRaw.trim()];
    }

    const sessionId = body.sessionId as unknown;
    if (!isUuid(sessionId)) return json(req, 400, { ok: false, code: "INVALID_SESSION" });

    const allowedModes: ReadonlySet<string> = new Set(["for_you","friends","trending","combined"]);
    if (!allowedModes.has(requestedMode)) return json(req, 400, { ok: false, code: "INVALID_MODE" });
    const allowedKinds: ReadonlySet<string> = new Set(["movie","series","anime"]);
    if (kindFilter !== null && !allowedKinds.has(kindFilter)) return json(req, 400, { ok: false, code: "INVALID_KIND_FILTER" });

    const deckId = randomUuid();
    const recRequestId = randomUuid();
    const explicitSeed = typeof body.seed === "string" ? body.seed.trim() : "";

    // Cold-start behavior (app-side): if the user has very few strong positives,
    // "for_you" can feel empty/repetitive. We transparently switch to a mixed
    // deck so the user sees quality content immediately.
    let mode: Mode = requestedMode;
    let seed = explicitSeed || randomUuid();
    let nStrong: number | null = null;
    if (requestedMode === "for_you" && !Boolean(body?.forceForYou)) {
      nStrong = await countStrongPosSignals(supabase, auth.user.id, { lookbackDays: coldStartLookbackDays, shortCircuitAt: coldStartMinStrong, eventLimit: coldStartEventLimit, thresholds: tasteThresholds });
      if (nStrong < coldStartMinStrong) {
        mode = "combined";
        // If the client didn't provide a seed, make one stable per-day to reduce
        // flicker for brand-new users.
        if (!explicitSeed) seed = `cold:${sessionId}:${kindFilter ?? "all"}:${utcDay()}`;
      }
    }

    // We intentionally request more rows than the UI needs so we can:
    // - skip rows missing OMDb posters (premium UX requirement)
    // - still return a full deck without extra client round-trips
    const hasFilters = minImdbRating != null || (genresAny && genresAny.length);
    const extraFactor = hasFilters
      ? clamp(Number(deckCfg?.rpc_extra_factor_with_filters ?? 3) || 3, 1, 6)
      : clamp(Number(deckCfg?.rpc_extra_factor_base ?? 2) || 2, 1, 6);

    const rpcLimitCap = clamp(Number(deckCfg?.rpc_limit_cap ?? 120) || 120, 1, 200);
    const rpcLimit = clamp(Math.min(Math.max(limit * extraFactor, limit), rpcLimitCap, maxLimit), 1, rpcLimitCap);

    const runDeckRpc = async (seedValue: string, limitValue: number) =>
      supabase.rpc("media_swipe_deck_v3", {
        p_session_id: sessionId,
        p_limit: limitValue,
        p_mode: mode,
        p_kind_filter: kindFilter,
        p_seed: seedValue,
      });

    let effectiveRpcLimit = rpcLimit;
    let { data, error } = await runDeckRpc(seed, rpcLimit);

    if (error && isStatementTimeout(error) && rpcLimit > limit) {
      effectiveRpcLimit = limit;
      ({ data, error } = await runDeckRpc(seed, effectiveRpcLimit));
    }

    if (error) return json(req, 500, { ok: false, code: "RPC_FAILED", message: error.message });

    let rows = (data ?? []) as any[];

    // If the deck returns fewer than requested (dedupe/filters), try one more time with a different seed suffix.
    if (Boolean(deckCfg?.fill_second_attempt_enabled ?? true) && rows.length < effectiveRpcLimit) {
      const suffix = String(deckCfg?.fill_second_seed_suffix ?? "fill2").trim() || "fill2";
      const seed2 = `${seed}:${suffix}`;
      const { data: data2, error: error2 } = await runDeckRpc(seed2, effectiveRpcLimit);
      if (!error2 && Array.isArray(data2) && data2.length) {
        const seen = new Set(rows.map((r) => String(r.media_item_id ?? "")));
        for (const r of data2 as any[]) {
          const id = String(r.media_item_id ?? "");
          if (!id || seen.has(id)) continue;
          rows.push(r);
          seen.add(id);
          if (rows.length >= effectiveRpcLimit) break;
        }
      }
    }

    // ---------------------------------------------------------------------
    // Global exclude set (used by CF injection + cold-start segment-pop)
    // ---------------------------------------------------------------------
    // Goal: reduce wasted impressions by avoiding items the user has recently seen
    // or explicitly rejected. This is best-effort and should never fail the request.
    const exclude = new Set<string>();
    const now = Date.now();
    const days = (n: number) => n * 24 * 60 * 60 * 1000;
    const notInterestedWindowMs = days(Number(deckCfg?.not_interested_suppress_days ?? 30) || 30);
    const dislikeWindowMs = days(Number(deckCfg?.dislike_suppress_days ?? 14) || 14);
    const hideWindowMs = days(Number(deckCfg?.hide_suppress_days ?? 30) || 30);

    try {
      const { data: recentImp } = await supabase
        .from("rec_impressions")
        .select("media_item_id")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(3000);
      for (const r of (recentImp ?? []) as any[]) {
        const id = String(r?.media_item_id ?? "");
        if (id) exclude.add(id);
      }
    } catch {
      // ignore
    }

    try {
      const { data: negOut } = await supabase
        .from("rec_outcomes")
        .select("media_item_id,outcome_type,created_at")
        .eq("user_id", auth.user.id)
        .in("outcome_type", ["dislike", "not_interested", "hide"])
        .order("created_at", { ascending: false })
        .limit(3000);

      for (const r of (negOut ?? []) as any[]) {
        const id = String(r?.media_item_id ?? "");
        const t = r?.created_at ? Date.parse(String(r.created_at)) : NaN;
        if (!id) continue;
        const age = Number.isFinite(t) ? now - t : 0;
        const kind = String(r?.outcome_type ?? "");

        if (kind === "not_interested") {
          if (age <= notInterestedWindowMs) exclude.add(id);
          continue;
        }
        if (kind === "hide") {
          if (age <= hideWindowMs) exclude.add(id);
          continue;
        }
        if (kind === "dislike") {
          if (age <= dislikeWindowMs) exclude.add(id);
          continue;
        }
      }
    } catch {
      // ignore
    }

    try {
      // Also exclude already-interacted items (like/watchlist/rating/skip), acting as a seen filter.
      const { data: seenEv } = await supabase
        .from("media_events")
        .select("media_item_id,event_type,created_at")
        .eq("user_id", auth.user.id)
        .in("event_type", [
          "like",
          "dislike",
          "skip",
          "watchlist",
          "watchlist_add",
          "watchlist_remove",
          "rating",
          "rating_set",
        ])
        .order("created_at", { ascending: false })
        .limit(5000);
      for (const r of (seenEv ?? []) as any[]) {
        const id = String(r?.media_item_id ?? "");
        if (id) exclude.add(id);
      }
    } catch {
      // ignore
    }

    
    // --- Optional collaborative filtering (CF) candidates (ALS baseline) ---
    // Experiment-gated. This injects additional candidate rows before ranking/reranking.
    // Variants:
    // - off (default)
    // - on_10 / on_25 / on_40  -> number of CF candidates to add
    const cfQuota = (() => {
      const v = String(cfVariant || "off");
      if (v === "on_10") return 10;
      if (v === "on_25") return 25;
      if (v === "on_40") return 40;
      return 0;
    })();

    let cfAdded = 0;
    try {
      if (cfQuota > 0 && auth?.user?.id) {
        const modelVersion = String(deckCfg?.cf_model_version ?? "als_v1");
        const reader = svc ?? supabase;

        const { data: cfRows } = await reader
          .from("cf_recos")
          .select("media_item_id, score, rank")
          .eq("user_id", auth.user.id)
          .eq("model_version", modelVersion)
          .order("rank", { ascending: true })
          .limit(clamp(cfQuota, 5, 200));

        if (Array.isArray(cfRows) && cfRows.length) {
          const seen = new Set(rows.map((r: any) => String(r.media_item_id ?? "")));
          for (const id of exclude) seen.add(id);
          for (const cr of cfRows as any[]) {
            const id = String(cr.media_item_id ?? "");
            if (!id || seen.has(id)) continue;
            rows.push({
              media_item_id: id,
              source: "cf",
              why: "Because people with similar taste liked this", // may be refined later
              retrieval_score: cr.score != null ? Number(cr.score) : null,
              cf_rank: cr.rank != null ? Number(cr.rank) : null,
            });
            seen.add(id);
            cfAdded++;
            if (cfAdded >= cfQuota) break;
          }
        }
      }
    } catch {
      // best-effort: ignore CF failures
    }


    // --- Cold-start segment popularity fallback (onboarding genres) ---
    // If CF is enabled but we have no CF rows yet (new user), we inject popular items
    // from the user's preferred genres (recsys_user_prefs). This keeps personalization
    // meaningful even before the ALS job has enough signal.
    let segPopAdded = 0;
    try {
      const isColdStart = (requestedMode === "for_you") && (nStrong != null) && (nStrong < coldStartMinStrong);
      const wantsSegFallback = isColdStart && cfQuota > 0 && cfAdded === 0;

      if (wantsSegFallback) {
        const { data: prefs } = await supabase
          .from("recsys_user_prefs")
          .select("preferred_genres, muted_genres")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        const preferred = Array.isArray((prefs as any)?.preferred_genres) ? (prefs as any).preferred_genres : [];
        const muted = new Set<string>(
          (Array.isArray((prefs as any)?.muted_genres) ? (prefs as any).muted_genres : [])
            .map((g: any) => String(g ?? "").trim().toLowerCase())
            .filter(Boolean),
        );

        const genres = preferred
          .map((g: any) => String(g ?? "").trim())
          .filter((g: string) => g.length && !muted.has(g.toLowerCase()))
          .slice(0, 10);

        if (genres.length) {
          const orParts = genres.map((g: string) => `omdb_genre.ilike.%${g.replaceAll(",", " ")}%`);
          const q = supabase
            .from("media_items")
            .select("id, omdb_title, omdb_genre, tmdb_popularity, tmdb_vote_average, tmdb_vote_count, omdb_poster, tmdb_poster_path, tmdb_backdrop_path")
            .order("tmdb_popularity", { ascending: false, nullsFirst: false })
            .limit(clamp(Number((deckCfg as any)?.seg_pop_pool_limit ?? 200), 50, 1000));

          if (kindFilter) q.eq("kind", kindFilter);
          if (orParts.length) q.or(orParts.join(","));

          const { data: pool } = await q;

          const seen = new Set(rows.map((r: any) => String(r.media_item_id ?? "")));
          for (const id of exclude) seen.add(id);

          const segQuota = clamp(Number((deckCfg as any)?.seg_pop_quota ?? Math.min(20, Math.floor(limit / 3))), 5, 40);

          for (const it of (pool ?? []) as any[]) {
            const id = String(it?.id ?? "");
            if (!id || seen.has(id)) continue;
            // ensure we have at least one poster path (OMDb or TMDB) to avoid wasted slots
            const hasPoster = Boolean(cleanOmdbPosterUrl(it?.omdb_poster) || it?.tmdb_poster_path || it?.tmdb_backdrop_path);
            if (!hasPoster) continue;

            // Choose a short "why" based on the first matching genre token.
            const itemGenres = String(it?.omdb_genre ?? "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            const match = genres.find((g: string) => itemGenres.some((ig) => ig.toLowerCase() === g.toLowerCase()));
            const why = match ? `Popular in ${match}` : "Popular in your preferred genres";

            rows.push({
              media_item_id: id,
              source: "seg_pop",
              why,
              popularity: it?.tmdb_popularity ?? null,
              vote_average: it?.tmdb_vote_average ?? null,
              vote_count: it?.tmdb_vote_count ?? null,
              poster_path: it?.tmdb_poster_path ?? null,
              backdrop_path: it?.tmdb_backdrop_path ?? null,
            });

            seen.add(id);
            segPopAdded++;
            if (segPopAdded >= segQuota) break;
          }
        }
      }
    } catch {
      // best-effort
    }


    // --- Apply muted genres preference (best-effort) ---
    // If the user has muted genres, filter out items whose OMDb genre list matches.
    // This is intentionally best-effort and will never reduce the deck below the requested limit.
    try {
      const applyMuted = Boolean((deckCfg as any)?.apply_muted_genres ?? true);
      if (applyMuted && auth?.user?.id) {
        const { data: prefs } = await supabase
          .from("recsys_user_prefs")
          .select("muted_genres")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        const muted = new Set<string>(
          (Array.isArray((prefs as any)?.muted_genres) ? (prefs as any).muted_genres : [])
            .map((g: any) => String(g ?? "").trim().toLowerCase())
            .filter(Boolean),
        );

        if (muted.size) {
          const ids = Array.from(
            new Set(rows.map((r: any) => String(r?.media_item_id ?? "")).filter(Boolean)),
          ).slice(0, clamp(Number((deckCfg as any)?.media_item_fetch_ids_cap ?? 500), 50, 1000));

          if (ids.length) {
            const { data: meta } = await supabase
              .from("media_items")
              .select("id, omdb_genre")
              .in("id", ids);

            const genreMap = new Map<string, string>();
            for (const m of (meta ?? []) as any[]) {
              const id = String(m?.id ?? "");
              if (!id) continue;
              genreMap.set(id, String(m?.omdb_genre ?? ""));
            }

            const matchesMuted = (id: string) => {
              const g = (genreMap.get(id) ?? "");
              if (!g) return false;
              const toks = g
                .split(",")
                .map((x) => x.trim().toLowerCase())
                .filter(Boolean);
              for (const t of toks) {
                if (muted.has(t)) return true;
              }
              return false;
            };

            const filteredAll = rows.filter((r: any) => {
              const id = String(r?.media_item_id ?? "");
              if (!id) return true;
              return !matchesMuted(id);
            });

            // Only accept the filter if we still have enough candidates to serve.
            if (filteredAll.length >= limit) {
              rows = filteredAll;
            } else {
              // Otherwise, at least filter seg_pop items (cold-start fallback) to respect muted genres.
              rows = rows.filter((r: any) => {
                const id = String(r?.media_item_id ?? "");
                if (!id) return true;
                if (String(r?.source ?? "") !== "seg_pop") return true;
                return !matchesMuted(id);
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // --- Muted genres filtering (best-effort) ---
    // If a user muted certain genres, try to remove those items from all candidate sources.
    // This is best-effort and will not reduce the deck below the requested limit.
    try {
      const applyMuted = Boolean((deckCfg as any)?.apply_muted_genres ?? true);
      if (applyMuted && auth?.user?.id) {
        const { data: prefs2 } = await supabase
          .from("recsys_user_prefs")
          .select("muted_genres")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        const muted2 = (Array.isArray((prefs2 as any)?.muted_genres) ? (prefs2 as any).muted_genres : [])
          .map((g: any) => String(g ?? "").trim().toLowerCase())
          .filter(Boolean);

        if (muted2.length) {
          const ids = Array.from(new Set(rows.map((r: any) => String(r?.media_item_id ?? "")).filter(Boolean))).slice(0, 250);
          const { data: items } = await supabase
            .from("media_items")
            .select("id, omdb_genre")
            .in("id", ids);

          const map = new Map<string, string>();
          for (const it of (items ?? []) as any[]) {
            const id = String(it?.id ?? "");
            if (!id) continue;
            map.set(id, String(it?.omdb_genre ?? ""));
          }

          const isMuted = (id: string): boolean => {
            const g = map.get(id) ?? "";
            if (!g) return false;
            const toks = g.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
            return toks.some((t) => muted2.includes(t));
          };

          const filtered = rows.filter((r: any) => {
            const id = String(r?.media_item_id ?? "");
            if (!id) return false;
            return !isMuted(id);
          });

          if (filtered.length >= limit) {
            rows = filtered;
          } else {
            // If filtering would underfill, apply only to segment-pop items (soft enforcement).
            const soft = rows.filter((r: any) => {
              const id = String(r?.media_item_id ?? "");
              if (!id) return false;
              if (String(r?.source ?? "") !== "seg_pop") return true;
              return !isMuted(id);
            });
            if (soft.length >= limit) rows = soft;
          }
        }
      }
    } catch {
      // ignore
    }


    // --- Taste-match rerank (server-driven via embedding_settings) ---
    const settingsClient = svc ?? supabase;
    const cacheClient = supabase;
    const settings = await loadEmbeddingSettings(settingsClient);
    let skipRerank = Boolean(body?.skipRerank);
    // Experiment: disable rerank (keeps costs down and helps measure rerank lift).
    if (rerankVariant === "no_rerank") skipRerank = true;
    const rerankEnabled = Boolean(settings?.rerank_swipe_enabled) && !skipRerank;
    const rerankTopKMax = clamp(Number(settings?.rerank_top_k ?? 50), 5, 200);

    const explicitQuery = typeof body.rerankQuery === "string" ? body.rerankQuery.trim() : "";
    const canTasteRerank = mode === "for_you" || mode === "combined" || mode === "friends";

    let taste: TasteQueryResult = { query: "", strongPosCount: 0, lastStrongAt: null };
    if (rerankEnabled && !explicitQuery && canTasteRerank) {
      taste = await buildTasteQueryForUser(settingsClient, auth.user.id, tasteCfg as any, tasteMatchCfg);
    }

    const rerankQuery = explicitQuery || taste.query;

    // Freshness gating: if the user hasn't had a strong taste signal recently, avoid re-calling
    // the reranker on every refresh. We'll still use cached reranks if present.
    const nowMs = Date.now();
    const lastStrongMs = taste.lastStrongAt ? Date.parse(taste.lastStrongAt) : 0;
    const isFresh = Boolean(explicitQuery) || (Number.isFinite(lastStrongMs) && nowMs - lastStrongMs <= clamp(rerankFreshWindowSeconds, 0, 7 * 86400) * 1000);

    // Adaptive K: new/low-signal users get a smaller rerank candidate set (cheaper + faster).
    // This is configurable via ops.rerank.adaptive_topk (server-only).
    let rerankTopK = rerankTopKMax;
    if (explicitQuery) {
      const explicitMax = clamp(Number(adaptiveTopkCfg?.explicit_query_max ?? 60) || 60, 1, 200);
      rerankTopK = Math.min(rerankTopK, explicitMax);
    } else {
      const defaultTopK = clamp(Number(adaptiveTopkCfg?.default_topk ?? 60) || 60, 1, 200);
      const thresholds = Array.isArray(adaptiveTopkCfg?.thresholds) ? adaptiveTopkCfg.thresholds : [];
      const sorted = thresholds
        .filter((x: any) => x && typeof x.lt === "number" && typeof x.topk === "number")
        .sort((a: any, b: any) => Number(a.lt) - Number(b.lt));

      let chosen = defaultTopK;
      for (const t of sorted) {
        const lt = Number(t.lt);
        const topk = Number(t.topk);
        if (!Number.isFinite(lt) || !Number.isFinite(topk)) continue;
        if (taste.strongPosCount < lt) {
          chosen = topk;
          break;
        }
      }
      rerankTopK = Math.min(rerankTopK, clamp(chosen, 1, 200));
    }
    rerankTopK = clamp(Math.min(rerankTopK, rows.length), 1, 200);

    const canAttemptRerank = rerankEnabled && Boolean(rerankQuery) && rerankTopK >= 1;
    let rerankCacheStatus: "disabled" | "hit" | "miss" | "skipped" = "disabled";

    if (canAttemptRerank) {
      // Persistent + in-memory cooldown.
      const cooldownUntil = Math.max(await getCooldownUntil(cacheClient, auth.user.id), VOYAGE_RERANK_COOLDOWN_UNTIL);
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
      const cached = await getCachedRerankOrder(cacheClient, cacheKey);
      if (cached?.length) {
        rerankCacheStatus = "hit";
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
        rerankCacheStatus = "skipped";
        console.log("MEDIA_SWIPE_DECK_RERANK_SKIPPED", JSON.stringify({ reason: "cooldown", until: cooldownUntil }));
      } else if (!isFresh && !explicitQuery) {
        rerankCacheStatus = "skipped";
        console.log("MEDIA_SWIPE_DECK_RERANK_SKIPPED", JSON.stringify({ reason: "stale_profile", lastStrongAt: taste.lastStrongAt }));
      } else {
        // 2) Cache miss + eligible: call Voyage.
        rerankCacheStatus = "miss";
        const items = await fetchMediaItemsByIds(settingsClient, candidateIdsForHash);
        const miById = new Map(items.map((x: any) => [String(x.id), x]));

        try {
          const res = await rerankRowsWithVoyage(
            rows,
            { rerankQuery, rerankTopK, rerankModel },
            (row) => {
              const mi = miById.get(String(row.media_item_id));
              return mi ? buildRerankDocument(mi, { titleFallback: row.title ?? undefined, caps: (tasteMatchCfg as any)?.doc_caps }) : makeRerankDoc(row);
            },
          );

          rows = res.outRows;
          console.log(
            "MEDIA_SWIPE_DECK_RERANK_OK",
            JSON.stringify({ rerankModel, queryLen: rerankQuery.length, in: rows.length, rerankCandidates: res.rerankCandidates, scored: res.scored, topK: rerankTopK }),
          );

          if (res.orderIds.length) {
            await putCachedRerankOrder(cacheClient, {
              key: cacheKey,
              userId: auth.user.id,
              orderIds: res.orderIds,
              meta: { mode, seed, kindFilter, profileVersionMinute, rerankTopK },
              ttlSeconds: rerankCacheTtlSeconds,
            });
          }
        } catch (err) {
          const msg = String((err as any)?.message ?? err);
          if (msg.includes("(429)")) {
            VOYAGE_RERANK_COOLDOWN_UNTIL = Date.now() + 90_000;
            await setCooldown(cacheClient, auth.user.id, rerankCooldown429Seconds, "voyage_429");
            console.warn("MEDIA_SWIPE_DECK_WARN rerank 429; enabling cooldown", JSON.stringify({ cooldownSeconds: rerankCooldown429Seconds }));
          }
          console.warn("MEDIA_SWIPE_DECK_WARN rerank failed, returning base order:", msg);
        }
      }
    }

    // --- Build cards using ONLY OMDb columns for user-visible info ---
    // Requirement:
    // - Use OMDb-derived columns for title/plot/poster/ratings/etc
    // - If omdb_poster is empty (or "N/A"), skip the card entirely.
    const candidateIds = rows.map((r) => String(r.media_item_id ?? "")).filter(Boolean);
    const mediaItems = await fetchMediaItemsByIds(settingsClient, candidateIds);
    const miById = new Map(mediaItems.map((x: any) => [String(x.id), x]));

    // --- CF explainability enhancement (best-effort) ---
    // If we injected CF candidates, try to rewrite their "why" into:
    //   "Because you liked <title>"
    // using similarity to the user's recent strong positives.
    let cfWhyById: Map<string, string> | null = null;
    try {
      if (cfAdded > 0) {
        const lookbackDays = clamp(Number((deckCfg as any)?.cf_why_lookback_days ?? 90), 7, 365);
        const eventLimit = clamp(Number((deckCfg as any)?.cf_why_event_limit ?? 200), 50, 500);
        const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * lookbackDays).toISOString();

        const { data: evs } = await supabase
          .from("media_events")
          .select("event_type, media_item_id, created_at, dwell_ms, rating_0_10, in_watchlist")
          .eq("user_id", auth.user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(eventLimit);

        const strongIds: string[] = [];
        const seenStrong = new Set<string>();
        for (const e of (evs ?? []) as any[]) {
          const row: any = e;
          if (!isStrongPositiveEvent(row, tasteThresholds)) continue;
          const id = String(row.media_item_id ?? "");
          if (!id || seenStrong.has(id)) continue;
          seenStrong.add(id);
          strongIds.push(id);
          if (strongIds.length >= clamp(Number((deckCfg as any)?.cf_why_seed_max ?? 8), 1, 20)) break;
        }

        if (strongIds.length) {
          const seeds = await fetchMediaItemsByIds(settingsClient, strongIds);
          const seedById = new Map(seeds.map((x: any) => [String(x.id), x]));

          const seedFeat = strongIds
            .map((id) => {
              const mi = seedById.get(id);
              if (!mi) return null;
              return {
                id,
                title: (mi.omdb_title ?? mi.tmdb_title ?? mi.tmdb_name ?? "something you liked") as string,
                genres: String(mi.omdb_genre ?? "")
                  .split(",")
                  .map((g) => g.trim())
                  .filter(Boolean),
                actors: String(mi.omdb_actors ?? ""),
                director: String(mi.omdb_director ?? ""),
              };
            })
            .filter(Boolean) as any[];

          if (seedFeat.length) {
            cfWhyById = new Map<string, string>();
            // For each CF item in the candidate list, pick the most similar seed.
            for (const r of rows) {
              const src = String((r as any)?.source ?? "");
              if (src !== "cf") continue;
              const id = String((r as any)?.media_item_id ?? "");
              const mi = miById.get(id);
              if (!mi) continue;

              const cand = {
                genres: String(mi.omdb_genre ?? "")
                  .split(",")
                  .map((g) => g.trim())
                  .filter(Boolean),
                actors: String(mi.omdb_actors ?? ""),
                director: String(mi.omdb_director ?? ""),
              };

              let best: { title: string; sim: number } | null = null;
              for (const s of seedFeat) {
                const sim = cardSimilarity(
                  { genres: cand.genres, actors: cand.actors, director: cand.director },
                  { genres: s.genres, actors: s.actors, director: s.director },
                );
                if (!best || sim > best.sim) best = { title: s.title, sim };
              }

              if (best && best.sim >= clamp01(Number((deckCfg as any)?.cf_why_min_sim ?? 0.28))) {
                cfWhyById.set(id, `Because you liked ${best.title}`);
              }
            }
          }
        }
      }
    } catch {
      // ignore (never block)
    }

    let cards: any[] = [];
    const buildCap = clamp(Number(deckCfg?.build_cap ?? effectiveRpcLimit) || effectiveRpcLimit, limit, 300);
    for (const r of rows) {
      if (cards.length >= buildCap) break;

      const mediaItemId = String(r.media_item_id ?? "");
      if (!mediaItemId) continue;

      const mi = miById.get(mediaItemId) ?? {};

      const tmdbPosterPath = (r.poster_path ?? mi.tmdb_poster_path ?? null) as string | null;
      const tmdbBackdropPath = (r.backdrop_path ?? mi.tmdb_backdrop_path ?? null) as string | null;

      // Prefer OMDb poster, but fall back to TMDB so the deck never renders empty
      const posterUrl =
        cleanOmdbPosterUrl(mi.omdb_poster) ??
        tmdbImageUrl(tmdbPosterPath, "w500") ??
        tmdbImageUrl(tmdbBackdropPath, "w780");

      if (!posterUrl) continue;
const title = (mi.omdb_title ?? r.title ?? null) as string | null;
      const overview = (mi.omdb_plot ?? null) as string | null;

      const kind = (mi.omdb_type ?? mi.kind ?? r.kind ?? "other") as string;
      const releaseYear = parseOmdbYear(mi.omdb_year);

      const runtimeMinutes =
        parseOmdbRuntimeMinutes(mi.omdb_runtime) ??
        parseOmdbRuntimeMinutes(r.omdb_runtime) ??
        (typeof r.runtime_minutes === "number" ? r.runtime_minutes : null);

      const imdbRating = parseOmdbImdbRating(mi.omdb_imdb_rating);
      const rtTomatoMeter = parseOmdbPercent(mi.omdb_rating_rotten_tomatoes);

      const genres =
        mi.omdb_genre != null
          ? String(mi.omdb_genre)
              .split(",")
              .map((g: string) => g.trim())
              .filter(Boolean)
          : null;

      // Apply optional request filters (best-effort).
      if (minImdbRating != null && imdbRating != null && imdbRating < minImdbRating) {
        continue;
      }
      if (genresAny && genresAny.length && Array.isArray(genres) && genres.length) {
        const set = new Set(genres.map((g) => String(g).toLowerCase()));
        const ok = genresAny.some((g) => set.has(String(g).toLowerCase()));
        if (!ok) continue;
      }

      cards.push({
        mediaItemId,

        // Core card content (OMDb)
        title,
        overview,
        kind,
        releaseDate: mi.omdb_released ?? null,
        releaseYear,
        runtimeMinutes,
        posterUrl,
        genres,
        language: mi.omdb_language ?? null,
        country: mi.omdb_country ?? null,
        imdbRating,
        rtTomatoMeter,

        // Extra OMDb details (used in details/full-details UI)
        director: mi.omdb_director ?? null,
        writer: mi.omdb_writer ?? null,
        actors: mi.omdb_actors ?? null,
        rated: mi.omdb_rated ?? null,
        metascore: mi.omdb_metascore ?? null,
        imdbVotes: mi.omdb_imdb_votes ?? null,
        awards: mi.omdb_awards ?? null,
        boxOffice: mi.omdb_box_office ?? null,

        // TMDB fallback fields (used when OMDb is missing)
tmdbPosterPath,
tmdbBackdropPath,
tmdbVoteAverage: r.vote_average != null ? Number(r.vote_average) : null,
tmdbVoteCount: r.vote_count != null ? Number(r.vote_count) : null,
tmdbPopularity: r.popularity != null ? Number(r.popularity) : null,
completeness: r.completeness != null ? Number(r.completeness) : null,

        // Recommendation metadata
        source: r.source ?? mode,
        why: (cfWhyById && String(r.source ?? mode) === "cf") ? (cfWhyById.get(String(mediaItemId)) ?? (r.why ?? null)) : (r.why ?? null),
        friendIds: Array.isArray(r.friend_ids) ? r.friend_ids : (r.friend_ids ? [r.friend_ids] : []),

        // Optional numeric retrieval score (present for CF injections)
        retrieval_score: (r as any).retrieval_score != null ? Number((r as any).retrieval_score) : null,
      });
    }


        // Optional score blending (variant-gated). This reorders cards using a lightweight
    // score + source multipliers. To keep experiments interpretable, we only apply
    // blending when the source-mix experiment is not active.
    let blendApplied = false;
    try {
      const skipWhenMix = Boolean((blendCfg as any)?.skip_when_mix_active ?? true);
      const mixIsActive = String(mixVariant || "control") !== "control";
      const blendEnabled = (blendCfg as any)?.enabled !== false;
      if (blendEnabled && !(skipWhenMix && mixIsActive)) {
        const blendRes = applyBlendVariant(cards as any, blendVariant, blendCfg);
        if (blendRes.applied) {
          (cards as any).splice(0, (cards as any).length, ...blendRes.cards);
          blendApplied = true;
        }
      }
    } catch {
      // never block
    }

// Optional deck composition control (variant-gated). This allows us to A/B
    // different source mixes without changing the underlying SQL RPC.
    let mixApplied = false;
    try {
      const mixRes = applyMixVariant(cards as any, mixVariant);
      if (mixRes.applied) {
        (cards as any).splice(0, (cards as any).length, ...mixRes.cards);
        mixApplied = true;
      }
    } catch {
      // never block
    }

    // Attach friend profile info (avatar stack) for Friends’ picks
    // This keeps frontend simple and avoids N extra requests.
    try {
      const allFriendIds = new Set<string>();
      for (const c of cards as any[]) {
        if (c.source === "friends" && Array.isArray(c.friendIds)) {
          for (const fid of c.friendIds) allFriendIds.add(String(fid));
        }
      }
      const ids = Array.from(allFriendIds).filter(Boolean);
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles_public")
          .select("id, display_name, username, avatar_url")
          .in("id", ids);

        const map = new Map<string, any>();
        for (const p of (profs ?? []) as any[]) map.set(String(p.id), p);

        for (const c of cards as any[]) {
          if (c.source !== "friends") continue;
          c.friendProfiles = (c.friendIds ?? [])
            .map((fid: any) => map.get(String(fid)))
            .filter(Boolean);
        }
      }
    } catch (_e) {
      // ignore (never block deck serving)
    }

    // Optional diversity re-ordering (MMR). This is experiment-gated and uses only
    // cheap metadata signals (genres/actors/director) to reduce near-duplicates.
    // IMPORTANT: this runs after the rerank step so we can measure diversity lift
    // without conflating it with rerank.
    let diversityApplied = false;
    const shouldDiversify = Boolean(body?.diversify) || diversityVariant === "mmr" || diversityVariant === "diversify";
    if (shouldDiversify) {
      try {
        const topN = clamp(Number((deckCfg as any)?.diversity_top_n ?? 40), 5, 120);
        const lambda = clamp(Number((deckCfg as any)?.diversity_lambda ?? 0.72), 0, 1);
        const diversified = mmrDiversify(cards as any, { topN, lambda });
        // Mutate in-place to keep downstream logging consistent.
        (cards as any).splice(0, (cards as any).length, ...diversified);
        diversityApplied = true;
      } catch {
        // ignore
      }
    }


    // Best-effort: log ranking features for LTR training.
    // Prefer service-role (bypasses RLS), but fall back to the user client
    // if you have permissive insert policies.
    // This should never block serving a deck.
    {
      const logClient = svc ?? supabase;
      try {
        const servedCards = (cards ?? []).slice(0, limit);
        const featureRows = servedCards.map((c, idx) => ({
          user_id: auth.user.id,
          session_id: sessionId,
          deck_id: deckId,
          position: idx,
          mode,
          cf_variant: cfVariant,
          cf_added: cfAdded,
          seg_pop_added: typeof segPopAdded === "number" ? segPopAdded : 0,
          kind_filter: kindFilter,
          source: c.source ?? mode,
          media_item_id: c.mediaItemId,
          features: {
            experiments,
            rerank_variant: rerankVariant,
            cf_variant: cfVariant,
            cf_added: cfAdded,
            seg_pop_added: typeof segPopAdded === "number" ? segPopAdded : 0,
            diversity_variant: diversityVariant,
            diversity_applied: diversityApplied,
            mix_variant: mixVariant,
            mix_applied: mixApplied,
            blend_variant: blendVariant,
            blend_applied: blendApplied,
            // deck context
            seed,
            rerank_enabled: rerankEnabled,
            rerank_query_len: rerankQuery ? rerankQuery.length : 0,
            rerank_top_k: rerankTopK,
            rerank_cache_status: rerankCacheStatus,
            why_len: c.why ? String(c.why).length : 0,
            friend_ids_count: Array.isArray((c as any).friendIds) ? (c as any).friendIds.length : 0,
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

    // Persist server-side impressions (best-effort). This ensures offline datasets
    // are based on what we actually served, even if the client drops events.
    try {
      const servedCards = (cards ?? []).slice(0, limit);

      const impressionRows = servedCards.map((c: any, idx: number) => ({
        rec_request_id: recRequestId,
        user_id: auth.user.id,
        session_id: sessionId,
        deck_id: deckId,
        media_item_id: c.mediaItemId,
        position: idx,
        source: (c as any).source ?? null,
        dedupe_key: `${recRequestId}:${idx}:${c.mediaItemId}`,
        request_context: {
          mode,
          requestedMode,
          kindFilter,
          seed,
          limit,
          experiments,
          cf_variant: cfVariant,
          cf_added: cfAdded,
          seg_pop_added: typeof segPopAdded === "number" ? segPopAdded : 0,
          rerank_variant: rerankVariant,
          diversity_variant: diversityVariant,
          diversity_applied: diversityApplied,
          mix_variant: mixVariant,
          mix_applied: mixApplied,
          blend_variant: blendVariant,
          blend_applied: blendApplied,
        },
      }));

      if (impressionRows.length) {
        const { error: impErr } = await supabase
          .from("rec_impressions")
          .insert(impressionRows, { returning: "minimal" });
        void impErr;
      }
    } catch {
      // ignore impression logging failures
    }

const servedCards = (cards ?? []).slice(0, limit);

    return json(req, 200, { ok: true, deckId, recRequestId, cards: servedCards });
  } catch (err) {
    return json(req, 500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
