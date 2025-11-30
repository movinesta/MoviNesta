import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import type { TitleType } from "../search/useSearchTitles";

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

interface LibraryRow {
  id: string;
  title_id: string;
  status: string;
  updated_at: string;
  titles: {
    id: string;
    title: string | null;
    year: number | null;
    type: TitleType | null;
    poster_url: string | null;
    backdrop_url: string | null;
  } | null;
}

interface RatingRow {
  title_id: string;
  rating: number | null;
}

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
        .select(
          "id, title_id, status, updated_at, titles!inner ( id, title, year, type, poster_url, backdrop_url )",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as LibraryRow[];

      if (!rows.length) return [];

      const titleIds = Array.from(
        new Set(rows.map((row) => row.title_id).filter((id): id is string => Boolean(id))),
      );

      let ratingsByTitleId = new Map<string, number | null>();

      if (titleIds.length) {
        const { data: ratings, error: ratingsError } = await supabase
          .from("ratings")
          .select("title_id, rating")
          .eq("user_id", userId)
          .in("title_id", titleIds);

        if (!ratingsError && ratings) {
          ratingsByTitleId = new Map(
            (ratings as RatingRow[]).map((row) => [row.title_id, row.rating]),
          );
        } else if (ratingsError) {
          console.warn(
            "[useDiaryLibrary] Failed to load ratings for library entries",
            ratingsError.message,
          );
        }
      }

      return rows.map((row) => {
        const title = row.titles;
        const rating = ratingsByTitleId.get(row.title_id) ?? null;

        return {
          id: row.id,
          titleId: row.title_id,
          status: row.status as DiaryStatus,
          updatedAt: row.updated_at,
          title: (title?.title ?? "Untitled") as string,
          year: title?.year ?? null,
          type: (title?.type ?? null) as TitleType | null,
          posterUrl: title?.poster_url ?? title?.backdrop_url ?? null,
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
    error: (query.error as Error | null)?.message ?? null,
  };
};

interface UpdateStatusArgs {
  titleId: string;
  status: DiaryStatus;
}

interface UpdateRatingArgs {
  titleId: string;
  rating: number | null;
}

export const useDiaryLibraryMutations = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ titleId, status }: UpdateStatusArgs) => {
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase.from("library_entries").upsert(
        {
          user_id: userId,
          title_id: titleId,
          status,
          updated_at: new Date().toISOString(),
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
        queryClient.invalidateQueries({ queryKey: ["diary", "library", userId] });
        queryClient.invalidateQueries({ queryKey: ["diary", "stats", userId] });
        queryClient.invalidateQueries({ queryKey: ["home-for-you", userId] });
      }
    },
  });

  const updateRating = useMutation({
    mutationFn: async ({ titleId, rating }: UpdateRatingArgs) => {
      if (!userId) throw new Error("Not authenticated");

      if (rating == null) {
        const { error } = await supabase
          .from("ratings")
          .delete()
          .eq("user_id", userId)
          .eq("title_id", titleId);

        if (error) throw new Error(error.message);

        return { titleId, rating: null };
      }

      const { error } = await supabase.from("ratings").upsert(
        {
          user_id: userId,
          title_id: titleId,
          rating,
          updated_at: new Date().toISOString(),
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
        queryClient.invalidateQueries({ queryKey: ["diary", "library", userId] });
        queryClient.invalidateQueries({ queryKey: ["diary", "stats", userId] });
        queryClient.invalidateQueries({ queryKey: ["home-for-you", userId] });
      }
    },
  });

  return {
    updateStatus,
    updateRating,
  };
};
