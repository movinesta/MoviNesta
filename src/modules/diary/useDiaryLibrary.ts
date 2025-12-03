import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/types/supabase";
import { supabase } from "../../lib/supabase";
import { qk } from "../../lib/queryKeys";
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

type LibraryRow = Database["public"]["Tables"]["library_entries"]["Row"];
type TitleRow = Pick<
  Database["public"]["Tables"]["titles"]["Row"],
  "title_id" | "primary_title" | "release_year" | "content_type" | "poster_url" | "backdrop_url"
>;
type LibraryRowWithTitle = LibraryRow & { titles: TitleRow | null };
type RatingRow = Pick<Database["public"]["Tables"]["ratings"]["Row"], "title_id" | "rating">;

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
          `
            id, title_id, status, updated_at, content_type,
            titles!inner (
              title_id, primary_title, release_year, content_type, poster_url, backdrop_url
            )
          `,
        )
        .returns<LibraryRowWithTitle[]>()
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) {
        throw new Error(error.message);
      }

      const rows = data ?? [];

      if (!rows.length) return [];

      const titleIds = Array.from(
        new Set(rows.map((row) => row.title_id).filter((id): id is string => Boolean(id))),
      );

      let ratingsByTitleId = new Map<string, number | null>();

      if (titleIds.length) {
        const { data: ratings, error: ratingsError } = await supabase
          .from("ratings")
          .select("title_id, rating")
          .returns<RatingRow[]>()
          .eq("user_id", userId)
          .in("title_id", titleIds);

        if (!ratingsError && ratings) {
          ratingsByTitleId = new Map(ratings.map((row) => [row.title_id, row.rating]));
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
          status: row.status,
          updatedAt: row.updated_at,
          title: title?.primary_title ?? "Untitled",
          year: title?.release_year ?? null,
          type: title?.content_type ?? null,
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
    error: query.error instanceof Error ? query.error.message : null,
  };
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

      let contentType = type ?? null;

      if (!contentType) {
        const { data: titleRow, error: titleError } = await supabase
          .from("titles")
          .select("content_type")
          .eq("title_id", titleId)
          .maybeSingle();

        if (titleError) {
          throw new Error(titleError.message);
        }

        contentType = titleRow?.content_type ?? null;
      }

      if (!contentType) {
        throw new Error("Unable to determine title type for library entry");
      }

      const { error } = await supabase.from("library_entries").upsert(
        {
          user_id: userId,
          title_id: titleId,
          status,
          content_type: contentType,
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

      if (rating == null) {
        const { error } = await supabase
          .from("ratings")
          .delete()
          .eq("user_id", userId)
          .eq("title_id", titleId);

        if (error) throw new Error(error.message);

        return { titleId, rating: null };
      }

      let contentType = type ?? null;

      if (!contentType) {
        const { data: titleRow, error: titleError } = await supabase
          .from("titles")
          .select("content_type")
          .eq("title_id", titleId)
          .maybeSingle();

        if (titleError) {
          throw new Error(titleError.message);
        }

        contentType = titleRow?.content_type ?? null;
      }

      if (!contentType) {
        throw new Error("Unable to determine title type for rating");
      }

      const { error } = await supabase.from("ratings").upsert(
        {
          user_id: userId,
          title_id: titleId,
          content_type: contentType,
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