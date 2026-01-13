import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { getPreferredLanguageForTmdb } from "@/i18n/useI18n";

type TmdbProxyResponse<T = unknown> = { ok: true; data: T };

type TmdbTitleResult = {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string | null;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
};

type TmdbTrendingResponse = {
  results: TmdbTitleResult[];
};

export async function fetchTmdbJson(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  signal?: AbortSignal,
) {
  const payload = {
    path,
    params: {
      ...(path === "/configuration" ? {} : { language: getPreferredLanguageForTmdb() }),
      ...params,
    },
  };

  try {
    const result = await callSupabaseFunction<TmdbProxyResponse>("tmdb-proxy", payload, {
      signal,
      // TMDb proxy is read-only; opt-in to a couple of retries for transient edge/upstream issues.
      retries: 2,
      retryDelayMs: 250,
    });
    return result.data;
  } catch (err) {
    console.warn(`[tmdb] Request error for ${path}:`, err);
    return null;
  }
}



// ---------------------------------------------------------------------------
// TMDB configuration cache (images)
// ---------------------------------------------------------------------------

// TMDB recommends caching configuration values (base_url + sizes) and then
// building image URLs from: base_url + size + file_path.
// The secure_base_url is preferred when available.
//
// We cache this client-side to avoid repeated calls.

type TmdbConfiguration = {
  images?: {
    base_url?: string;
    secure_base_url?: string;
    backdrop_sizes?: string[];
    poster_sizes?: string[];
    profile_sizes?: string[];
    logo_sizes?: string[];
    still_sizes?: string[];
  };
};

type TmdbConfigCache = {
  fetchedAt: number; // epoch ms
  images: NonNullable<TmdbConfiguration["images"]>;
};

const TMDB_CONFIG_STORAGE_KEY = "movinesta_tmdb_config_cache_v1";
const TMDB_CONFIG_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

let tmdbConfigCache: TmdbConfigCache | null = null;

function normalizeBaseUrl(url: string): string {
  const s = String(url || "").trim();
  if (!s) return "";
  return s.endsWith("/") ? s : `${s}/`;
}

function safeParseCachedConfig(raw: string | null): TmdbConfigCache | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.fetchedAt !== "number") return null;
    const images = parsed.images;
    if (!images || typeof images !== "object") return null;
    const base = normalizeBaseUrl(images.secure_base_url ?? images.base_url ?? "");
    if (!base) return null;
    return {
      fetchedAt: parsed.fetchedAt,
      images: {
        ...images,
        base_url: normalizeBaseUrl(images.base_url ?? ""),
        secure_base_url: normalizeBaseUrl(images.secure_base_url ?? ""),
      },
    };
  } catch {
    return null;
  }
}

function getCachedConfig(): TmdbConfigCache | null {
  if (tmdbConfigCache) return tmdbConfigCache;
  if (typeof window === "undefined") return null;
  try {
    tmdbConfigCache = safeParseCachedConfig(window.localStorage.getItem(TMDB_CONFIG_STORAGE_KEY));
    return tmdbConfigCache;
  } catch {
    return null;
  }
}

function setCachedConfig(cfg: TmdbConfigCache) {
  tmdbConfigCache = cfg;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TMDB_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export function getTmdbImageBaseUrl(): string {
  const cfg = getCachedConfig();
  const base = cfg?.images?.secure_base_url ?? cfg?.images?.base_url ?? "";
  return normalizeBaseUrl(base || "https://image.tmdb.org/t/p/");
}

export async function refreshTmdbConfigurationCache(options?: { force?: boolean }) {
  const force = Boolean(options?.force);
  const cached = getCachedConfig();
  const now = Date.now();
  if (!force && cached && now - cached.fetchedAt < TMDB_CONFIG_MAX_AGE_MS) return;

  const conf = (await fetchTmdbJson("/configuration")) as TmdbConfiguration | null;
  const images = conf?.images;
  if (!images) return;

  const base = normalizeBaseUrl(images.secure_base_url ?? images.base_url ?? "");
  if (!base) return;

  setCachedConfig({ fetchedAt: now, images });
}
export type TmdbImageSize = "w185" | "w342" | "w500" | "w780" | "w1280" | "original";

export function tmdbImageUrl(path: string | null | undefined, size: TmdbImageSize = "w500") {
  if (!path) return null;
  const base = getTmdbImageBaseUrl();
  // TMDB: base_url + size + file_path
  return `${base}${size}${path}`;
}

export type TmdbMediaType = "movie" | "tv";

export type TmdbTitle = {
  id: number;
  title: string;
  overview: string | null;
  releaseDate: string | null;
  posterPath: string | null;
  mediaType: TmdbMediaType;
  voteAverage: number | null;
};

export async function fetchTrendingTitles(limit = 20, signal?: AbortSignal): Promise<TmdbTitle[]> {
  const body = (await fetchTmdbJson(
    "/trending/all/week",
    {
      include_adult: false,
      page: 1,
    },
    signal,
  )) as TmdbTrendingResponse;

  const results = Array.isArray(body?.results) ? (body.results as TmdbTitleResult[]) : [];

  return results
    .filter((item): item is TmdbTitleResult & { id: number; media_type: "movie" | "tv" } => {
      return Boolean(
        item &&
        typeof item.id === "number" &&
        (item.media_type === "movie" || item.media_type === "tv"),
      );
    })
    .slice(0, limit)
    .map((item) => {
      const releaseDate = item.release_date ?? item.first_air_date ?? null;
      return {
        id: Number(item.id),
        title: item.title ?? item.name ?? "Untitled",
        overview: item.overview ?? null,
        releaseDate,
        posterPath: item.poster_path ?? null,
        mediaType: item.media_type === "tv" ? "tv" : "movie",
        voteAverage: typeof item.vote_average === "number" ? item.vote_average : null,
      } satisfies TmdbTitle;
    });
}
