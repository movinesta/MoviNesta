import type { Database } from "@/types/supabase";

export interface RatingBucket {
  rating: number; // 0.5 steps
  count: number;
}

export interface GenreStat {
  genre: string;
  count: number;
}

export interface WatchCountPoint {
  month: string; // YYYY-MM
  count: number;
}

export interface DiaryStats {
  totalRated: number;
  totalWatched: number;
  averageRating: number | null;
  ratingDistribution: RatingBucket[];
  topGenres: GenreStat[];
  watchCountByMonth: WatchCountPoint[];
}

export const EMPTY_STATS: DiaryStats = {
  totalRated: 0,
  totalWatched: 0,
  averageRating: null,
  ratingDistribution: [],
  topGenres: [],
  watchCountByMonth: [],
};

type RatingsRow = Pick<
  Database["public"]["Tables"]["ratings"]["Row"],
  "rating" | "created_at" | "title_id"
>;

type LibraryRow = Pick<
  Database["public"]["Tables"]["library_entries"]["Row"],
  "title_id" | "status" | "updated_at"
>;

type GenreRow = Database["public"]["Tables"]["genres"]["Row"];

type GenreLookupRow = Pick<GenreRow, "id" | "name">;

type TitleGenreRow = Database["public"]["Tables"]["title_genres"]["Row"];

export const mapGenresById = (rows: GenreLookupRow[]): Map<number, string> => {
  return new Map(rows.map((g) => [g.id, g.name]));
};

export const computeTopGenres = (
  watchedRows: LibraryRow[],
  titleGenres: TitleGenreRow[],
  genresById: Map<number, string>,
): GenreStat[] => {
  if (!watchedRows.length || !titleGenres.length || genresById.size === 0) {
    return [];
  }

  const watchedIds = new Set(
    watchedRows
      .filter((row) => row.status === "watched")
      .map((row) => row.title_id)
      .filter((id): id is string => Boolean(id)),
  );

  const genreCountMap = new Map<string, number>();

  titleGenres.forEach((row) => {
    if (!watchedIds.has(row.title_id)) return;
    const name = genresById.get(row.genre_id);
    if (!name) return;
    genreCountMap.set(name, (genreCountMap.get(name) ?? 0) + 1);
  });

  return Array.from(genreCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([genre, count]) => ({ genre, count }));
};

export const reduceDiaryStats = (
  ratingsRows: RatingsRow[],
  libraryRows: LibraryRow[],
  topGenres: GenreStat[] = [],
): DiaryStats => {
  const watchedRows = libraryRows.filter((row) => row.status === "watched");

  const bucketMap = new Map<number, number>();
  let sumRatings = 0;
  let ratingCount = 0;

  ratingsRows.forEach((row) => {
    const raw = row.rating;
    if (typeof raw !== "number" || Number.isNaN(raw)) return;

    const bucket = Math.round(raw * 2) / 2; // 0.5 steps
    bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);

    sumRatings += raw;
    ratingCount += 1;
  });

  const ratingDistribution: RatingBucket[] = Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rating, count]) => ({ rating, count }));

  const averageRating = ratingCount > 0 ? sumRatings / ratingCount : null;

  const watchByMonthMap = new Map<string, number>();

  watchedRows.forEach((row) => {
    const d = new Date(row.updated_at);
    if (Number.isNaN(d.getTime())) return;

    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    watchByMonthMap.set(key, (watchByMonthMap.get(key) ?? 0) + 1);
  });

  const watchCountByMonth: WatchCountPoint[] = Array.from(watchByMonthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  return {
    totalRated: ratingsRows.length,
    totalWatched: watchedRows.length,
    averageRating,
    ratingDistribution,
    topGenres,
    watchCountByMonth,
  };
};

export type { LibraryRow, RatingsRow, GenreLookupRow, TitleGenreRow };
