import { fetchTmdbJson, tmdbImageUrl } from "../../lib/tmdb";

type ExternalMediaType = "movie" | "tv";

type TmdbMultiResult = {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  imdb_id?: string | null;
  poster_path?: string | null;
};

type TmdbMultiSearchResponse = {
  results: TmdbMultiResult[];
  total_pages: number;
};

export type ExternalTitleResult = {
  tmdbId: number;
  imdbId: string | null;
  title: string;
  year: number | null;
  type: ExternalMediaType;
  posterUrl: string | null;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
};

export async function searchExternalTitles(
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<{ results: ExternalTitleResult[]; hasMore: boolean }> {
  throwIfAborted(signal);

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { results: [], hasMore: false };
  }

  const body = (await fetchTmdbJson(
    "/search/multi",
    {
      query: trimmedQuery,
      page,
      include_adult: false, // ✅ boolean, not string
    },
    signal,
  )) as TmdbMultiSearchResponse | null;

  const tmdbResults = Array.isArray(body?.results) ? body!.results : [];
  const totalPages = typeof body?.total_pages === "number" ? body!.total_pages : 1;

  const filtered = tmdbResults.filter((item) => {
    if (!item) return false;
    if (typeof item.id !== "number") return false;
    if (item.media_type !== "movie" && item.media_type !== "tv") return false;
    return true;
  });

  return {
    results: filtered.map((item) => {
      const mediaType: ExternalMediaType = item.media_type === "tv" ? "tv" : "movie";
      const releaseDate: string | null = item.release_date ?? item.first_air_date ?? null;
      const year = releaseDate ? Number(String(releaseDate).slice(0, 4)) : null;

      return {
        tmdbId: Number(item.id),
        imdbId: item.imdb_id ?? null,
        title: item.title ?? item.name ?? "Untitled",
        year: Number.isNaN(year) ? null : year,
        type: mediaType,
        posterUrl: tmdbImageUrl(item.poster_path ?? null),
      } satisfies ExternalTitleResult;
    }),
    hasMore: page < totalPages,
  };
}
