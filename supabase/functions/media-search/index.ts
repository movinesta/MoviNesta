// supabase/functions/media-search/index.ts
//
// Authenticated title search over public.media_items with optional Voyage rerank-2.5.
//
// - Reads embedding_settings.rerank_search_enabled and embedding_settings.rerank_top_k.
// - When enabled, reranks the *current page* of candidates using Voyage rerank.
// - Always falls back to base order if rerank is disabled or fails.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { VOYAGE_RERANK_MODEL } from "../_shared/config.ts";
import { voyageRerank } from "../_shared/voyage.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "media-search";

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

    if (error || !data) return null;

    return {
      rerank_search_enabled: Boolean((data as any).rerank_search_enabled),
      rerank_top_k: clamp(Number((data as any).rerank_top_k ?? 20), 5, 200),
    };
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

async function maybeRerank(
  client: SupabaseClient<Database>,
  query: string,
  rows: MediaItemRow[],
  opts: { skipRerank: boolean },
): Promise<MediaItemRow[]> {
  if (opts.skipRerank) return rows;

  const settings = await loadEmbeddingSettings(client);
  if (!settings?.rerank_search_enabled) return rows;

  if (!query || rows.length < 2) return rows;

  // Only rerank the first K items in the current page.
  const k = Math.min(rows.length, clamp(settings.rerank_top_k, 5, 200));
  const subset = rows.slice(0, k);
  const docs = subset.map(makeRerankDoc);

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

    if (!order.length) return rows;

    const used = new Set<number>();
    const reranked: MediaItemRow[] = [];
    for (const i of order) {
      if (used.has(i)) continue;
      used.add(i);
      reranked.push(subset[i]);
    }
    // Append any subset items that didn't get scored, then the rest of the page.
    for (let i = 0; i < subset.length; i++) {
      if (!used.has(i)) reranked.push(subset[i]);
    }
    reranked.push(...rows.slice(k));

    console.log(
      "MEDIA_SEARCH_RERANK_OK",
      JSON.stringify({ model: VOYAGE_RERANK_MODEL || "rerank-2.5", queryLen: query.length, in: rows.length, rerankCandidates: k, scored: order.length }),
    );

    return reranked;
  } catch (err) {
    console.warn("MEDIA_SEARCH_WARN rerank failed, returning base order:", String((err as any)?.message ?? err));
    return rows;
  }
}

async function handleSearch(
  client: SupabaseClient<Database>,
  args: Required<SearchRequest>,
): Promise<Response> {
  const { query, page, limit, filters, skipRerank } = args;
  const offset = (page - 1) * limit;

  let builder = client.from("media_items").select(COLUMNS, { count: "exact" });
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

  const reranked = await maybeRerank(client, query, rows, { skipRerank });

  return jsonResponse({ ok: true, query, page, limit, hasMore, totalCount, results: reranked });
}

export async function handler(req: Request) {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const { data, errorResponse } = await validateRequest<SearchRequest>(req, parseRequestBody, {
    logPrefix: `[${FN_NAME}]`,
  });
  if (errorResponse) return errorResponse;

  const client = getUserClient(req);
  const args: Required<SearchRequest> = {
    query: data.query,
    page: data.page ?? 1,
    limit: data.limit ?? 20,
    filters: data.filters ?? {},
    skipRerank: Boolean(data.skipRerank),
  };

  return await handleSearch(client, args);
}

serve(handler);
