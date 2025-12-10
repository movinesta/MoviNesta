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
      language: getPreferredLanguageForTmdb(),
      ...params,
    },
  };

  try {
    const result = await callSupabaseFunction<TmdbProxyResponse>("tmdb-proxy", payload, { signal });
    return result.data;
  } catch (err) {
    console.warn(`[tmdb] Request error for ${path}:`, err);
    return null;
  }
}

export type TmdbImageSize = "w185" | "w342" | "w500" | "w780" | "w1280" | "original";

export function tmdbImageUrl(path: string | null | undefined, size: TmdbImageSize = "w500") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
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
