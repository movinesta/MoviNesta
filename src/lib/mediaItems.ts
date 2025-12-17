import { tmdbImageUrl, type TmdbImageSize } from "./tmdb";
import type { Database } from "@/types/supabase";
import type { TitleType } from "@/types/supabase-helpers";

export type MediaItemRow = Database["public"]["Tables"]["media_items"]["Row"];

export type MediaItemSummary = {
  id: string;
  title: string;
  year: number | null;
  type: TitleType | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  originalLanguage: string | null;
  ageRating: string | null;
  imdbRating: number | null;
  rtTomatoMeter: number | null;
  imdbId: string | null;
  tmdbId: number | null;
};

const parseYearFromDate = (value?: string | null): number | null => {
  if (!value) return null;
  const year = Number(String(value).slice(0, 4));
  return Number.isFinite(year) ? year : null;
};

const parseYearFromOmdb = (value?: string | null): number | null => {
  if (!value) return null;
  const match = String(value).match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
};

const deriveTitle = (row: MediaItemRow): string => {
  const candidates = [
    row.omdb_title,
    row.tmdb_title,
    row.tmdb_name,
    row.tmdb_original_title,
    row.tmdb_original_name,
  ];

  const title = candidates.find((value) => Boolean(value && value.trim()));
  return title?.trim() || "Untitled";
};

const deriveKind = (kind?: string | null): TitleType | null => {
  if (!kind) return null;
  if (kind === "movie") return "movie";
  if (kind === "series" || kind === "tv") return "series";
  if (kind === "anime") return "anime";
  return null;
};

const derivePosterUrl = (row: MediaItemRow, size: TmdbImageSize = "w500"): string | null => {
  if (row.omdb_poster && row.omdb_poster.trim()) return row.omdb_poster.trim();
  return tmdbImageUrl(row.tmdb_poster_path, size);
};

const deriveBackdropUrl = (row: MediaItemRow, size: TmdbImageSize = "w780"): string | null => {
  return tmdbImageUrl(row.tmdb_backdrop_path, size);
};

const parseRottenTomatoes = (value?: string | null): number | null => {
  if (!value) return null;
  const match = String(value).match(/(\d{1,3})/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
};

const normalizeLanguage = (row: MediaItemRow): string | null => {
  if (row.tmdb_original_language) return row.tmdb_original_language;
  if (row.omdb_language) {
    const first = row.omdb_language.split(",")[0]?.trim();
    return first || null;
  }
  return null;
};

export const mapMediaItemToSummary = (row: MediaItemRow): MediaItemSummary => {
  const releaseDate = row.tmdb_release_date ?? row.tmdb_first_air_date ?? null;
  const year = parseYearFromDate(releaseDate) ?? parseYearFromOmdb(row.omdb_year);

  return {
    id: row.id,
    title: deriveTitle(row),
    year,
    type: deriveKind(row.kind),
    posterUrl: derivePosterUrl(row),
    backdropUrl: deriveBackdropUrl(row),
    originalLanguage: normalizeLanguage(row),
    ageRating: row.omdb_rated ?? null,
    imdbRating: row.omdb_imdb_rating ?? null,
    rtTomatoMeter: parseRottenTomatoes(row.omdb_rating_rotten_tomatoes),
    imdbId: row.omdb_imdb_id ?? null,
    tmdbId: row.tmdb_id != null ? Number(row.tmdb_id) : null,
  } satisfies MediaItemSummary;
};
