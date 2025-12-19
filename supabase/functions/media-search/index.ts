// supabase/functions/media-search/index.ts
//
// Authenticated title search over public.media_items with optional Voyage rerank-2.5.
//
// - Reads embedding_settings.rerank_search_enabled and embedding_settings.rerank_top_k.
// - When enabled, reranks the *current page* of candidates using Voyage rerank.
// - Always falls back to base order if rerank is disabled or fails.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { VOYAGE_RERANK_MODEL } from "../_shared/config.ts";
import { voyageRerank } from "../_shared/voyage.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "media-search";

// Cache + cooldown knobs (seconds)
// - SEARCH_* env vars override shared defaults.
const DEFAULT_CACHE_TTL_SECONDS = 10 * 60;
const DEFAULT_429_COOLDOWN_SECONDS = 5 * 60;

function envInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const SEARCH_RERANK_CACHE_TTL_SECONDS = envInt(
  "SEARCH_RERANK_CACHE_TTL_SECONDS",
  envInt("RERANK_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS),
);

const SEARCH_RERANK_429_COOLDOWN_SECONDS = envInt(
  "SEARCH_RERANK_429_COOLDOWN_SECONDS",
  envInt("RERANK_429_COOLDOWN_SECONDS", DEFAULT_429_COOLDOWN_SECONDS),
);

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const helper = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (typeof v !== "object") return v;
    if (seen.has(v)) return "[Circular]";
    seen.add(v);
    if (Array.isArray(v)) return v.map(helper);
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = helper(v[k]);
    return out;
  };
  return JSON.stringify(helper(value));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function is429(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return msg.includes("(429)") || msg.includes(" 429") || msg.includes("HTTP 429") || msg.includes("status 429");
}

type TitleType = "movie" | "series" | "anime";

interface TitleSearchFilters {
  type?: TitleType | "all";
  minYear?: number;
  maxYear?: number;
  originalLanguage?: string;
  genreIds?: number[];
}

interface SearchRequest {
  query: string;
  page?: number;
  limit?: number;
  filters?: TitleSearchFilters;
  // Lets callers avoid provider calls for background prefetch.
  skipRerank?: boolean;
}

type MediaItemRow = Database["public"]["Tables"]["media_items"]["Row"];


const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));


function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

const COLUMNS = [
  "id",
  "kind",
  "tmdb_id",
  "tmdb_title",
  "tmdb_name",
  "tmdb_original_title",
  "tmdb_original_name",
  "tmdb_release_date",
  "tmdb_first_air_date",
  "tmdb_poster_path",
  "tmdb_backdrop_path",
  "tmdb_original_language",
  "tmdb_genre_ids",
  "tmdb_overview",
  "tmdb_genres",
  "omdb_title",
  "omdb_year",
  "omdb_language",
  "omdb_imdb_id",
  "omdb_imdb_rating",
  "omdb_rating_rotten_tomatoes",
  "omdb_poster",
  "omdb_rated",
  "omdb_plot",
  "omdb_genre",
].join(",");

async function loadEmbeddingSettings(
  client: SupabaseClient<Database>,
): Promise<{ rerank_search_enabled: boolean; rerank_top_k: number } | null> {
  try {
    const { data, error } = await client
      .from("embedding_settings")
      .select("rerank_search_enabled, rerank_top_k")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.warn(
        "MEDIA_SEARCH_SETTINGS_READ_ERROR",
        JSON.stringify({ message: error.message, code: (error as any).code ?? null }),
      );
      return null;
    }
    if (!data) {
      console.warn("MEDIA_SEARCH_SETTINGS_MISSING", JSON.stringify({ id: 1 }));
      return null;
    }

    const enabled = Boolean((data as any).rerank_search_enabled);
    const topK = clamp(Number((data as any).rerank_top_k ?? 20), 5, 200);
    console.log("MEDIA_SEARCH_SETTINGS", JSON.stringify({ enabled, topK }));
    return { rerank_search_enabled: enabled, rerank_top_k: topK };
  } catch {
    return null;
  }
}

function parseRequestBody(body: unknown): SearchRequest {
  if (typeof body !== "object" || body === null) throw new Error("Request body must be an object");
  const b = body as Record<string, unknown>;

  const query = typeof b.query === "string" ? b.query.trim() : "";
  if (!query) throw new Error("'query' is required");

  const page = b.page === undefined ? 1 : Number(b.page);
  const limit = b.limit === undefined ? 20 : Number(b.limit);
  if (!Number.isFinite(page) || page < 1) throw new Error("'page' must be >= 1");
  if (!Number.isFinite(limit) || limit < 1 || limit > 50) throw new Error("'limit' must be 1..50");

  const filters = (b.filters && typeof b.filters === "object") ? (b.filters as Record<string, unknown>) : undefined;
  const type = typeof filters?.type === "string" ? (filters.type as string) : undefined;
  if (type && !["movie", "series", "anime", "all"].includes(type)) {
    throw new Error("filters.type must be one of movie|series|anime|all");
  }

  const minYear = filters?.minYear === undefined ? undefined : Number(filters.minYear);
  const maxYear = filters?.maxYear === undefined ? undefined : Number(filters.maxYear);
  const originalLanguage = typeof filters?.originalLanguage === "string" ? String(filters.originalLanguage) : undefined;

  const genreIds = Array.isArray(filters?.genreIds)
    ? (filters!.genreIds as unknown[])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n))
    : undefined;

  const skipRerank = Boolean(b.skipRerank);

  return {
    query,
    page,
    limit,
    skipRerank,
    filters: {
      type: type as any,
      minYear: Number.isFinite(minYear as number) ? (minYear as number) : undefined,
      maxYear: Number.isFinite(maxYear as number) ? (maxYear as number) : undefined,
      originalLanguage,
      genreIds: genreIds?.length ? genreIds : undefined,
    },
  };
}

function guessTitle(row: any): string {
  return (
    row?.tmdb_title ||
    row?.tmdb_name ||
    row?.omdb_title ||
    row?.tmdb_original_title ||
    row?.tmdb_original_name ||
    "Untitled"
  );
}

function guessYear(row: any): string {
  const date = row?.tmdb_release_date || row?.tmdb_first_air_date || "";
  if (typeof date === "string" && date.length >= 4) return date.slice(0, 4);
  const y = row?.omdb_year;
  if (typeof y === "string" && y.length >= 4) return y.slice(0, 4);
  return "";
}

function compactGenres(row: any): string {
  // Prefer tmdb_genres json array [{name}]
  const tg = row?.tmdb_genres;
  if (Array.isArray(tg)) {
    const names = tg
      .map((g: any) => (typeof g?.name === "string" ? g.name.trim() : ""))
      .filter(Boolean)
      .slice(0, 8);
    if (names.length) return names.join(", ");
  }
  const og = row?.omdb_genre;
  if (typeof og === "string" && og.trim()) return og.trim();
  return "";
}

function makeRerankDoc(row: any): string {
  const title = guessTitle(row);
  const year = guessYear(row);
  const kind = row?.kind ? String(row.kind) : "";
  const lang = row?.tmdb_original_language ? String(row.tmdb_original_language) : (row?.omdb_language ? String(row.omdb_language) : "");
  const genres = compactGenres(row);
  const overview = typeof row?.tmdb_overview === "string" ? row.tmdb_overview.trim() : "";
  const plot = typeof row?.omdb_plot === "string" ? row.omdb_plot.trim() : "";
  const desc = overview || plot;

  // Keep it concise; rerank performs best on compact, consistent docs.
  const lines: string[] = [];
  lines.push(`${title}${year ? ` (${year})` : ""}${kind ? ` — ${kind}` : ""}`);
  if (genres) lines.push(`Genres: ${genres}`);
  if (lang) lines.push(`Language: ${lang}`);
  if (desc) lines.push(desc);
  return lines.join("\n");
}

async function getAuthedUserId(client: SupabaseClient<Database>): Promise<string | null> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function cacheGetOrderIds(
  client: SupabaseClient<Database>,
  key: string,
): Promise<string[] | null> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await client
      .from("media_rerank_cache")
      .select("order_ids, expires_at")
      .eq("key", key)
      .gt("expires_at", nowIso)
      .maybeSingle();
    if (error || !data) return null;
    const raw = (data as any).order_ids;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

async function cacheUpsert(
  client: SupabaseClient<Database>,
  row: { key: string; user_id: string; order_ids?: string; meta?: any; expires_at: string },
): Promise<void> {
  try {
    await client
      .from("media_rerank_cache")
      .upsert(
        {
          key: row.key,
          user_id: row.user_id,
          order_ids: row.order_ids ?? "[]",
          meta: row.meta ?? null,
          expires_at: row.expires_at,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "key" },
      );
  } catch {
    // Best-effort cache. Ignore failures (e.g., table missing or RLS).
  }
}

async function cooldownUntilMs(
  client: SupabaseClient<Database>,
  key: string,
): Promise<number | null> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await client
      .from("media_rerank_cache")
      .select("expires_at")
      .eq("key", key)
      .gt("expires_at", nowIso)
      .maybeSingle();
    if (error || !data) return null;
    const until = Date.parse(String((data as any).expires_at));
    return Number.isFinite(until) ? until : null;
  } catch {
    return null;
  }
}

function applyOrderIds(subset: MediaItemRow[], orderIds: string[]): MediaItemRow[] {
  const byId = new Map<string, MediaItemRow>();
  for (const r of subset) byId.set(String((r as any).id), r);
  const used = new Set<string>();
  const out: MediaItemRow[] = [];
  for (const id of orderIds) {
    const row = byId.get(String(id));
    if (!row) continue;
    const sid = String((row as any).id);
    if (used.has(sid)) continue;
    used.add(sid);
    out.push(row);
  }
  // Append any leftover rows from the subset to preserve completeness.
  for (const r of subset) {
    const sid = String((r as any).id);
    if (!used.has(sid)) out.push(r);
  }
  return out;
}

async function maybeRerank(
  userClient: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  query: string,
  rows: MediaItemRow[],
  opts: { skipRerank: boolean; page: number; limit: number; filters: TitleSearchFilters },
): Promise<{ rows: MediaItemRow[]; status: string }> {
  const settings = await loadEmbeddingSettings(adminClient);
  if (!settings) {
    // We couldn't read settings (most commonly RLS / missing service role). Be explicit.
    return { rows, status: "settings_unavailable" };
  }
  if (!settings.rerank_search_enabled || !query || rows.length < 2) {
    return { rows, status: settings.rerank_search_enabled ? "insufficient" : "disabled" };
  }

  const k = Math.min(rows.length, clamp(settings.rerank_top_k, 5, 200));
  const subset = rows.slice(0, k);
  const docs = subset.map(makeRerankDoc);

  // Cache key uses user_id and the exact candidate set being reranked.
  // This prevents repeated provider calls on tab focus/refetch.
  const userId = await getAuthedUserId(userClient);
  const now = new Date();
  const cacheTtlSec = SEARCH_RERANK_CACHE_TTL_SECONDS;

  const qHash = await sha256Hex(query.trim().toLowerCase());
  const fHash = await sha256Hex(stableStringify(opts.filters ?? {}));
  const candHash = await sha256Hex(subset.map((r) => String((r as any).id)).join(","));

  // Prefix with `search:` so it's easy to inspect from SQL with `key like 'search:%'`.
  const cacheKey = userId
    ? `search:voyage:${userId}:${qHash}:${opts.page}:${opts.limit}:${fHash}:${k}:${candHash}`
    : null;

  if (cacheKey && userId) {
    const cachedIds = await cacheGetOrderIds(adminClient, cacheKey);
    if (cachedIds?.length) {
      const rerankedSubset = applyOrderIds(subset, cachedIds);
      console.log(
        "MEDIA_SEARCH_RERANK_CACHE_HIT",
        JSON.stringify({ in: rows.length, rerankCandidates: k, key: cacheKey.slice(0, 90) + "…" }),
      );
      return { rows: [...rerankedSubset, ...rows.slice(k)], status: "cache_hit" };
    }
  }

  // Background prefetch: never call provider, but allow cached order.
  if (opts.skipRerank) {
    console.log("MEDIA_SEARCH_RERANK_SKIPPED", JSON.stringify({ reason: "skipRerank" }));
    return { rows, status: "skipRerank" };
  }

  // Cooldown: after a 429, skip rerank for a short time to avoid hammering Voyage.
  if (userId) {
    const cdKey = `cooldown:voyage_search_rerank:${userId}`;
    const untilMs = await cooldownUntilMs(adminClient, cdKey);
    if (untilMs && untilMs > Date.now()) {
      console.log("MEDIA_SEARCH_RERANK_SKIPPED", JSON.stringify({ reason: "cooldown", until: untilMs }));
      return { rows, status: "cooldown" };
    }
  }

  try {
    const { results } = await voyageRerank(query, docs, {
      model: VOYAGE_RERANK_MODEL || "rerank-2.5",
      topK: k,
      truncation: true,
    });

    const order = results
      .slice()
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map((r) => r.index)
      .filter((i) => i >= 0 && i < subset.length);

    if (!order.length) return { rows, status: "no_scores" };

    const orderedIds: string[] = [];
    const used = new Set<number>();
    const rerankedSubset: MediaItemRow[] = [];
    for (const i of order) {
      if (used.has(i)) continue;
      used.add(i);
      rerankedSubset.push(subset[i]);
      orderedIds.push(String((subset[i] as any).id));
    }
    // Append any subset items that didn't get scored.
    for (let i = 0; i < subset.length; i++) {
      if (!used.has(i)) {
        rerankedSubset.push(subset[i]);
        orderedIds.push(String((subset[i] as any).id));
      }
    }

    // Store cache (best-effort)
    if (cacheKey && userId) {
      const expires = addSeconds(now, cacheTtlSec).toISOString();
      await cacheUpsert(adminClient, {
        key: cacheKey,
        user_id: userId,
        order_ids: JSON.stringify(orderedIds),
        meta: {
          query,
          page: opts.page,
          limit: opts.limit,
          filters: opts.filters ?? {},
          rerankTopK: k,
        },
        expires_at: expires,
      });
      console.log(
        "MEDIA_SEARCH_RERANK_CACHE_SET",
        JSON.stringify({ in: rows.length, rerankCandidates: k, ttlSec: cacheTtlSec }),
      );
    }

    const reranked = [...rerankedSubset, ...rows.slice(k)];

    console.log(
      "MEDIA_SEARCH_RERANK_OK",
      JSON.stringify({ model: VOYAGE_RERANK_MODEL || "rerank-2.5", queryLen: query.length, in: rows.length, rerankCandidates: k, scored: order.length }),
    );

    return { rows: reranked, status: "ok" };
  } catch (err) {
    if (is429(err) && userId) {
      const cdKey = `cooldown:voyage_search_rerank:${userId}`;
      const until = addSeconds(new Date(), SEARCH_RERANK_429_COOLDOWN_SECONDS);
      await cacheUpsert(adminClient, {
        key: cdKey,
        user_id: userId,
        order_ids: "[]",
        meta: { reason: "429" },
        expires_at: until.toISOString(),
      });
      console.warn("MEDIA_SEARCH_WARN rerank rate-limited (429). Entering cooldown.");
      console.log("MEDIA_SEARCH_RERANK_SKIPPED", JSON.stringify({ reason: "cooldown_set", until: until.getTime() }));
      return { rows, status: "cooldown_set" };
    }
    console.warn("MEDIA_SEARCH_WARN rerank failed, returning base order:", String((err as any)?.message ?? err));
    return { rows, status: "error" };
  }
}

async function handleSearch(
  userClient: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  args: Required<SearchRequest>,
): Promise<Response> {
  const { query, page, limit, filters, skipRerank } = args;
  const offset = (page - 1) * limit;

  let builder = userClient.from("media_items").select(COLUMNS, { count: "exact" });
  builder = builder.range(offset, offset + limit - 1);

  const ilike = `%${query}%`;
  builder = builder.or(`tmdb_title.ilike.${ilike},tmdb_name.ilike.${ilike},omdb_title.ilike.${ilike}`);

  const t = filters?.type;
  if (t && t !== "all") {
    builder = builder.eq("kind", t === "series" ? "series" : t);
  }
  if (filters?.genreIds?.length) {
    builder = builder.overlaps("tmdb_genre_ids", filters.genreIds);
  }
  if (typeof filters?.minYear === "number") {
    const minDate = `${filters.minYear}-01-01`;
    builder = builder.or(`tmdb_release_date.gte.${minDate},tmdb_first_air_date.gte.${minDate}`);
  }
  if (typeof filters?.maxYear === "number") {
    const maxDate = `${filters.maxYear}-12-31`;
    builder = builder.or(`tmdb_release_date.lte.${maxDate},tmdb_first_air_date.lte.${maxDate}`);
  }
  if (filters?.originalLanguage) {
    builder = builder.eq("tmdb_original_language", filters.originalLanguage);
  }

  builder = builder
    .order("tmdb_release_date", { ascending: false, nullsLast: true })
    .order("tmdb_first_air_date", { ascending: false, nullsLast: true })
    .order("tmdb_title", { ascending: true, nullsLast: false });

  const { data, error, count } = await builder;
  if (error) return jsonError(error.message, 500, "SEARCH_FAILED");

  const rows = ((data as any) ?? []) as MediaItemRow[];
  const totalCount = typeof count === "number" ? count : undefined;
  const hasMore = totalCount ? offset + rows.length < totalCount : rows.length === limit;

  const { rows: rerankedRows, status: rerankStatus } = await maybeRerank(userClient, adminClient, query, rows, {
    skipRerank,
    page,
    limit,
    filters: filters ?? {},
  });

  return jsonResponse(
    { ok: true, query, page, limit, hasMore, totalCount, results: rerankedRows },
    200,
    { headers: { "x-movinesta-rerank": rerankStatus } },
  );
}

export async function handler(req: Request) {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const { data, errorResponse } = await validateRequest<SearchRequest>(req, parseRequestBody, {
    logPrefix: `[${FN_NAME}]`,
  });
  if (errorResponse) return errorResponse;

  // IMPORTANT:
  // Build a Supabase client that carries the end-user JWT from the request.
  // If we don't forward Authorization, Supabase queries run as `anon` and RLS will hide
  // embedding_settings (making rerank appear "disabled" even when it's enabled).
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(
      { ok: false, error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars" },
      500,
      { headers: { "x-movinesta-rerank": "error" } },
    );
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const apiKeyHeader = req.headers.get("apikey") ?? req.headers.get("x-api-key") ?? supabaseAnonKey;

  const userClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        apikey: apiKeyHeader,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Settings + cache should be readable/writable even when end-user RLS is strict.
  // Prefer service role if available; otherwise fall back to the authed user client.
  const adminClient = supabaseServiceRoleKey
    ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
        global: {
          headers: {
            apikey: supabaseServiceRoleKey,
            // No Authorization header: service role bypasses RLS.
          },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : userClient;
  const args: Required<SearchRequest> = {
    query: data.query,
    page: data.page ?? 1,
    limit: data.limit ?? 20,
    filters: data.filters ?? {},
    skipRerank: Boolean(data.skipRerank),
  };

  // Always log an invocation marker (even if rerank is disabled) so it's easy to verify behavior in Supabase logs.
  console.log(
    "MEDIA_SEARCH_REQ",
    JSON.stringify({ qLen: args.query.length, page: args.page, limit: args.limit, skipRerank: args.skipRerank }),
  );

  // Helpful debug marker so you can confirm whether service role is present.
  console.log(
    "MEDIA_SEARCH_SETTINGS_CLIENT",
    JSON.stringify({ serviceRole: Boolean(supabaseServiceRoleKey), authHeader: Boolean(authHeader) }),
  );

  return await handleSearch(userClient, adminClient, args);
}

serve(handler);
