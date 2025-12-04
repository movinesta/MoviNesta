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
  page = 1,
  signal?: AbortSignal,
): Promise<{ results: ExternalTitleResult[]; hasMore: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], hasMore: false };

  throwIfAborted(signal);

  const body = await fetchTmdbJson(
    "/search/multi",
    {
      query: trimmed,
      include_adult: "false",
      page,
    },
    signal,
  );

  throwIfAborted(signal);

  const results = Array.isArray(body?.results) ? (body.results as TmdbMultiResult[]) : [];
  if (!results.length) return { results: [], hasMore: false };

  const totalPages = typeof body?.total_pages === "number" ? body.total_pages : 1;

  return {
    results: results
    .filter((item): item is TmdbMultiResult & { id: number; media_type: ExternalMediaType } => {
      return Boolean(
        item &&
          typeof item.id === "number" &&
          (item.media_type === "movie" || item.media_type === "tv"),
      );
    })
    .slice(0, 20)
    .map((item) => {
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
