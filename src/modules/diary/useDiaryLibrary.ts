import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";
import { TitleType } from "@/types/supabase-helpers";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";
import { rating0_10ToStars, starsToRating0_10 } from "@/lib/ratings";

export type DiaryStatus = "want_to_watch" | "watching" | "watched" | "dropped";

export interface DiaryLibraryFilters {
  status?: DiaryStatus | "all";
  type?: TitleType | "all";
}

export interface DiaryLibraryEntry {
  id: string;
  titleId: string;
  status: DiaryStatus;
  updatedAt: string;
  title: string;
  year: number | null;
  type: TitleType | null;
  posterUrl: string | null;
  rating: number | null;
}

type LibraryRow = {
  id: string;
  title_id: string;
  status: DiaryStatus;
  updated_at: string;
  user_id: string;
  content_type: TitleType;
};

type TitleRow = ReturnType<typeof mapMediaItemToSummary>;
type RatingRow = { title_id: string; rating: number };
type TitleDiaryRow = { status: DiaryStatus };
type TitleDiaryRatingRow = { rating: number };

export const useDiaryLibrary = (filters: DiaryLibraryFilters, userIdOverride?: string | null) => {
  const { user } = useAuth();
  const userId = userIdOverride ?? user?.id ?? null;

  const query = useQuery({
    queryKey: ["diary", "library", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<DiaryLibraryEntry[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("library_entries")
        .select("id, title_id, status, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data as any as LibraryRow[]) ?? [];

      if (!rows.length) return [];

      const titleIds = Array.from(
        new Set(rows.map((row) => row.title_id).filter((id): id is string => Boolean(id))),
      );

      let titlesById = new Map<string, TitleRow>();
      if (titleIds.length) {
        const { data: titles, error: titlesError } = await supabase
          .from("media_items")
          .select(
            `id,
             kind,
             tmdb_title,
             tmdb_name,
             tmdb_original_title,
             tmdb_original_name,
             tmdb_release_date,
             tmdb_first_air_date,
             tmdb_poster_path,
             tmdb_backdrop_path,
             tmdb_original_language,
             omdb_title,
             omdb_year,
             omdb_language,
             omdb_imdb_id,
             omdb_imdb_rating,
             omdb_rating_rotten_tomatoes,
             omdb_poster,
             omdb_rated,
             tmdb_id`,
          )
          .in("id", titleIds);
        if (titlesError) {
          console.warn(
            "[useDiaryLibrary] Failed to load titles for library entries",
            titlesError.message,
          );
        } else {
          titlesById = new Map(
            (titles as MediaItemRow[]).map((row) => [row.id, mapMediaItemToSummary(row)]),
          );
        }
      }

      let ratingsByTitleId = new Map<string, number | null>();

      if (titleIds.length) {
        const { data: ratings, error: ratingsError } = await supabase
          .from("ratings")
          .select("title_id, rating")
          .eq("user_id", userId)
          .in("title_id", titleIds);

        if (!ratingsError && ratings) {
          ratingsByTitleId = new Map(
            (ratings as any as RatingRow[]).map((row) => [
              row.title_id,
              rating0_10ToStars(row.rating),
            ]),
          );
        } else if (ratingsError) {
          console.warn(
            "[useDiaryLibrary] Failed to load ratings for library entries",
            ratingsError.message,
          );
        }
      }

      return rows.map((row) => {
        const title = titlesById.get(row.title_id);
        const rating = ratingsByTitleId.get(row.title_id) ?? null;

        return {
          id: row.id,
          titleId: row.title_id,
          status: row.status,
          updatedAt: row.updated_at,
          title: title?.title ?? "Untitled",
          year: title?.year ?? null,
          type: title?.type ?? null,
          posterUrl: title?.posterUrl ?? title?.backdropUrl ?? null,
          rating,
        };
      });
    },
  });

  const entries = (query.data ?? []).filter((entry) => {
    if (filters.status && filters.status !== "all" && entry.status !== filters.status) {
      return false;
    }
    if (filters.type && filters.type !== "all" && entry.type !== filters.type) {
      return false;
    }
    return true;
  });

  return {
    entries,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
  };
};

export const useTitleDiaryEntry = (titleId: string | null | undefined) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: qk.titleDiary(userId, titleId),
    enabled: Boolean(userId && titleId),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async (): Promise<{ status: DiaryStatus | null; rating: number | null }> => {
      if (!userId || !titleId) {
        return { status: null, rating: null };
      }

      const [{ data: libraryRow, error: libraryError }, { data: ratingRow, error: ratingError }] =
        await Promise.all([
          supabase
            .from("library_entries")
            .select("status")
            .eq("user_id", userId)
            .eq("title_id", titleId)
            .maybeSingle(),
          supabase
            .from("ratings")
            .select("rating")
            .eq("user_id", userId)
            .eq("title_id", titleId)
            .maybeSingle(),
        ]);

      if (libraryError && libraryError.code !== "PGRST116") {
        throw libraryError;
      }
      if (ratingError && ratingError.code !== "PGRST116") {
        throw ratingError;
      }

      return {
        status: (libraryRow as any as TitleDiaryRow)?.status ?? null,
        rating: rating0_10ToStars((ratingRow as any as TitleDiaryRatingRow)?.rating ?? null),
      };
    },
  });
};

interface UpdateStatusArgs {
  titleId: string;
  status: DiaryStatus;
  type?: TitleType | null;
}

interface UpdateRatingArgs {
  titleId: string;
  rating: number | null;
  type?: TitleType | null;
}

export const useDiaryLibraryMutations = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ titleId, status, type }: UpdateStatusArgs) => {
      if (!userId) throw new Error("Not authenticated");
      if (!type) throw new Error("Content type is required");

      const { error } = await supabase.from("library_entries").upsert(
        {
          user_id: userId,
          title_id: titleId,
          status,
          updated_at: new Date().toISOString(),
          content_type: type,
        },
        {
          onConflict: "user_id,title_id",
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      return { titleId, status };
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: qk.diaryLibrary(userId) });
        queryClient.invalidateQueries({ queryKey: qk.diaryStats(userId) });
        queryClient.invalidateQueries({ queryKey: qk.homeForYou(userId) });
        queryClient.invalidateQueries({ queryKey: qk.titleDiary(userId, undefined) });
      }
    },
  });

  const updateRating = useMutation({
    mutationFn: async ({ titleId, rating, type }: UpdateRatingArgs) => {
      if (!userId) throw new Error("Not authenticated");
      if (!type) throw new Error("Content type is required");

      if (rating == null) {
        const { error } = await supabase
          .from("ratings")
          .delete()
          .eq("user_id", userId)
          .eq("title_id", titleId);

        if (error) throw new Error(error.message);

        return { titleId, rating: null };
      }

      const nextRating = starsToRating0_10(rating);
      if (nextRating == null) {
        throw new Error("Invalid rating value");
      }

      const { error } = await supabase.from("ratings").upsert(
        {
          user_id: userId,
          title_id: titleId,
          rating: nextRating,
          updated_at: new Date().toISOString(),
          content_type: type,
        },
        {
          onConflict: "user_id,title_id",
        },
      );

      if (error) throw new Error(error.message);

      return { titleId, rating };
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: qk.diaryLibrary(userId) });
        queryClient.invalidateQueries({ queryKey: qk.diaryStats(userId) });
        queryClient.invalidateQueries({ queryKey: qk.homeForYou(userId) });
        queryClient.invalidateQueries({ queryKey: qk.titleDiary(userId, undefined) });
      }
    },
  });

  return {
    updateStatus,
    updateRating,
  };
};
