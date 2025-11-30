const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const TMDB_READ_TOKEN = import.meta.env.VITE_TMDB_API_READ_ACCESS_TOKEN;

function buildHeaders() {
  const headers: Record<string, string> = { accept: "application/json" };
  if (TMDB_READ_TOKEN) {
    headers.Authorization = `Bearer ${TMDB_READ_TOKEN}`;
  }
  return headers;
}

export async function fetchTmdbJson(
  path: string,
  params?: Record<string, string | number | undefined>,
) {
  if (!TMDB_READ_TOKEN) {
    console.warn("[tmdb] Missing TMDB credentials. Set VITE_TMDB_API_READ_ACCESS_TOKEN.");
    return null;
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  try {
    const res = await fetch(url.toString(), {
      headers: buildHeaders(),
    });

    if (!res.ok) {
      console.warn(`[tmdb] Request failed for ${path}:`, res.status, res.statusText);
      return null;
    }

    return res.json();
  } catch (err) {
    console.warn(`[tmdb] Request error for ${path}:`, err);
    return null;
  }
}

export function tmdbImageUrl(path: string | null | undefined, size: "w500" | "w780" = "w500") {
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

export async function fetchTrendingTitles(limit = 20): Promise<TmdbTitle[]> {
  const body = await fetchTmdbJson("/trending/all/week", {
    include_adult: "false",
    language: "en-US",
    page: 1,
  });

  const results = (body?.results ?? []) as any[];
  if (!Array.isArray(results)) return [];

  return results
    .filter((item) => item && (item.media_type === "movie" || item.media_type === "tv") && item.id)
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
