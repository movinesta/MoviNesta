import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";

interface RatingRow {
  rating: number | null;
  created_at: string;
  title_id: string;
}

interface LibraryRow {
  title_id: string;
  status: string;
  updated_at: string;
}

interface TitleGenreRow {
  title_id: string;
  genre_id: number;
}

interface GenreRow {
  id: number;
  name: string;
}

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

const EMPTY_STATS: DiaryStats = {
  totalRated: 0,
  totalWatched: 0,
  averageRating: null,
  ratingDistribution: [],
  topGenres: [],
  watchCountByMonth: [],
};

export const useDiaryStats = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: qk.diaryStats(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<DiaryStats> => {
      if (!userId) return EMPTY_STATS;

      const [ratingsResult, libraryResult] = await Promise.all([
        supabase
          .from("ratings")
          .select("rating, created_at, title_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("library_entries")
          .select("title_id, status, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(500),
      ]);

      if (ratingsResult.error) {
        throw new Error(ratingsResult.error.message);
      }
      if (libraryResult.error) {
        throw new Error(libraryResult.error.message);
      }

      const ratingsRows = (ratingsResult.data ?? []) as RatingRow[];
      const libraryRows = (libraryResult.data ?? []) as LibraryRow[];

      const watchedRows = libraryRows.filter((row) => row.status === "watched");

      // Rating distribution & average
      const bucketMap = new Map<number, number>();
      let sumRatings = 0;
      let ratingCount = 0;

      ratingsRows.forEach((row) => {
        const raw =
          typeof row.rating === "number"
            ? row.rating
            : row.rating == null
              ? null
              : Number(row.rating);

        if (raw == null || Number.isNaN(raw)) return;

        const bucket = Math.round(raw * 2) / 2; // 0.5 steps
        bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);

        sumRatings += raw;
        ratingCount += 1;
      });

      const ratingDistribution: RatingBucket[] = Array.from(bucketMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([rating, count]) => ({ rating, count }));

      const averageRating = ratingCount > 0 ? sumRatings / ratingCount : null;

      // Watch count per month (by latest "watched" status update)
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

      // Top genres
      const titleIds = Array.from(
        new Set(watchedRows.map((row) => row.title_id).filter((id): id is string => Boolean(id))),
      );

      let topGenres: GenreStat[] = [];

      if (titleIds.length) {
        const { data: titleGenres, error: tgError } = await supabase
          .from("title_genres")
          .select("title_id, genre_id")
          .in("title_id", titleIds);

        if (!tgError && titleGenres) {
          const tgRows = titleGenres as TitleGenreRow[];
          const genreIds = Array.from(
            new Set(
              tgRows
                .map((row) => row.genre_id)
                .filter((id): id is number => typeof id === "number"),
            ),
          );

          let genresById = new Map<number, string>();

          if (genreIds.length) {
            const { data: genres, error: genresError } = await supabase
              .from("genres")
              .select("id, name")
              .in("id", genreIds);

            if (!genresError && genres) {
              genresById = new Map((genres as GenreRow[]).map((g) => [g.id, g.name]));
            } else if (genresError) {
              console.warn("[useDiaryStats] Failed to load genres", genresError.message);
            }
          }

          const genreCountMap = new Map<string, number>();

          tgRows.forEach((row) => {
            const name = genresById.get(row.genre_id);
            if (!name) return;
            genreCountMap.set(name, (genreCountMap.get(name) ?? 0) + 1);
          });

          topGenres = Array.from(genreCountMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([genre, count]) => ({ genre, count }));
        } else if (tgError) {
          console.warn("[useDiaryStats] Failed to load title_genres", tgError.message);
        }
      }

      return {
        totalRated: ratingsRows.length,
        totalWatched: watchedRows.length,
        averageRating,
        ratingDistribution,
        topGenres,
        watchCountByMonth,
      };
    },
  });

  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null)?.message ?? null,
  };
};