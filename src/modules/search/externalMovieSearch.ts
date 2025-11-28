import { fetchTmdbJson, tmdbImageUrl } from "../../lib/tmdb";

type ExternalMediaType = "movie" | "tv";

export type ExternalTitleResult = {
  tmdbId: number;
  imdbId: string | null;
  title: string;
  year: number | null;
  type: ExternalMediaType;
  posterUrl: string | null;
};

export async function searchExternalTitles(query: string): Promise<ExternalTitleResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const body = await fetchTmdbJson("/search/multi", {
    query: trimmed,
    include_adult: "false",
    language: "en-US",
    page: 1,
  });

  const results = (body?.results ?? []) as any[];
  if (!Array.isArray(results) || !results.length) return [];

  return results
    .filter((item) => (item.media_type === "movie" || item.media_type === "tv") && item.id)
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
    });
}
