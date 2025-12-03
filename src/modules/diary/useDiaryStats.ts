import { useQuery } from "@tanstack/react-query";
import {
  type DiaryStats,
  EMPTY_STATS,
  mapGenresById,
  reduceDiaryStats,
  type GenreLookupRow,
  type LibraryRow,
  type RatingsRow,
  type TitleGenreRow,
  computeTopGenres,
} from "./diaryStatsReducer";
import { supabase } from "../../lib/supabase";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";

export const useDiaryStats = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery<DiaryStats, Error>({
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

      const ratingsRows: RatingsRow[] = ratingsResult.data ?? [];
      const libraryRows: LibraryRow[] = libraryResult.data ?? [];

      const titleIds = Array.from(
        new Set(
          libraryRows
            .filter((row) => row.status === "watched")
            .map((row) => row.title_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      let topGenres = [] as DiaryStats["topGenres"];

      if (titleIds.length) {
        const { data: titleGenres, error: tgError } = await supabase
          .from("title_genres")
          .select("title_id, genre_id")
          .in("title_id", titleIds);

        if (!tgError && titleGenres) {
          const tgRows: TitleGenreRow[] = titleGenres;
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
              const genreRows: GenreLookupRow[] = genres;
              genresById = mapGenresById(genreRows);
            } else if (genresError) {
              console.warn("[useDiaryStats] Failed to load genres", genresError.message);
            }
          }

          const watchedRows = libraryRows.filter((row) => row.status === "watched");
          topGenres = computeTopGenres(watchedRows, tgRows, genresById);
        } else if (tgError) {
          console.warn("[useDiaryStats] Failed to load title_genres", tgError.message);
        }
      }

      return reduceDiaryStats(ratingsRows, libraryRows, topGenres);
    },
  });

  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message ?? null,
  };
};
