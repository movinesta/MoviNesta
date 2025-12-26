import { useQuery } from "@tanstack/react-query";
import { type DiaryStats, EMPTY_STATS } from "./diaryStatsReducer";
import type { Database } from "@/types/supabase";
import { supabase } from "../../lib/supabase";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";

type DiaryStatsRow = {
  rating_distribution: { rating: number; count: number }[] | null;
  top_genres: { genre: string; count: number }[] | null;
  watch_count_by_month: { month: string; count: number }[] | null;
  total_rated: number | null;
  total_watched: number | null;
  average_rating: number | null;
};

const toDiaryStats = (row?: DiaryStatsRow | null): DiaryStats => {
  if (!row) return EMPTY_STATS;

  const ratingDistribution: DiaryStats["ratingDistribution"] = Array.isArray(
    row.rating_distribution,
  )
    ? (row.rating_distribution
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rating = Number((item as Record<string, unknown>).rating);
        const count = Number((item as Record<string, unknown>).count);
        if (Number.isNaN(rating) || Number.isNaN(count)) return null;
        return { rating, count };
      })
      .filter(Boolean) as DiaryStats["ratingDistribution"])
    : [];

  const topGenres: DiaryStats["topGenres"] = Array.isArray(row.top_genres)
    ? (row.top_genres
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const genre = (item as Record<string, unknown>).genre;
        const count = Number((item as Record<string, unknown>).count);
        if (typeof genre !== "string" || Number.isNaN(count)) return null;
        return { genre, count };
      })
      .filter(Boolean) as DiaryStats["topGenres"])
    : [];

  const watchCountByMonth: DiaryStats["watchCountByMonth"] = Array.isArray(row.watch_count_by_month)
    ? (row.watch_count_by_month
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const month = (item as Record<string, unknown>).month;
        const count = Number((item as Record<string, unknown>).count);
        if (typeof month !== "string" || Number.isNaN(count)) return null;
        return { month, count };
      })
      .filter(Boolean) as DiaryStats["watchCountByMonth"])
    : [];

  const averageRaw = row.average_rating;
  const averageRating =
    averageRaw === null || typeof averageRaw === "undefined" ? null : Number(averageRaw);

  return {
    totalRated: Number(row.total_rated ?? 0),
    totalWatched: Number(row.total_watched ?? 0),
    averageRating: averageRating !== null && Number.isNaN(averageRating) ? null : averageRating,
    ratingDistribution,
    topGenres,
    watchCountByMonth,
  };
};

export const fetchDiaryStats = async (userId: string): Promise<DiaryStats> => {
  const { data, error } = await (supabase.rpc as any)("get_diary_stats", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return toDiaryStats((data as any)?.[0]);
};

export const useDiaryStats = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery<DiaryStats, Error>({
    queryKey: qk.diaryStats(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<DiaryStats> => {
      if (!userId) return EMPTY_STATS;

      return fetchDiaryStats(userId);
    },
  });

  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message ?? null,
  };
};
