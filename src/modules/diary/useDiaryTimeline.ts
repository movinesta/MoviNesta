import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface ActivityPayload {
  rating?: number;
  review_snippet?: string;
  headline?: string;
  extra?: string;
  emoji?: string;
}

interface ActivityEventRow {
  id: string;
  created_at: string;
  event_type: string;
  title_id: string | null;
  payload: ActivityPayload | null;
}

interface TitleRow {
  id: string;
  title: string | null;
  year: number | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
}

export type DiaryEventKind = "rating" | "review" | "watchlist" | "follow" | "other";

export interface DiaryTimelineItem {
  id: string;
  createdAt: string;
  kind: DiaryEventKind;
  titleId?: string | null;
  title?: string | null;
  year?: number | null;
  posterUrl?: string | null;
  rating?: number | null;
  reviewSnippet?: string | null;
  headline?: string | null;
  extra?: string | null;
  emoji?: string | null;
}

const mapEventTypeToDiaryKind = (eventType: string): DiaryEventKind => {
  switch (eventType) {
    case "rating_created":
      return "rating";
    case "review_created":
      return "review";
    case "watchlist_added":
      return "watchlist";
    case "follow_created":
      return "follow";
    default:
      return "other";
  }
};

export const useDiaryTimeline = (userIdOverride?: string | null) => {
  const { user } = useAuth();
  const userId = userIdOverride ?? user?.id ?? null;

  const query = useQuery({
    queryKey: ["diary", "timeline", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<DiaryTimelineItem[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("activity_events")
        .select("id, created_at, event_type, title_id, payload")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as ActivityEventRow[];

      if (!rows.length) return [];

      const titleIds = Array.from(
        new Set(rows.map((row) => row.title_id).filter((id): id is string => Boolean(id))),
      );

      let titlesById = new Map<string, TitleRow>();

      if (titleIds.length) {
        const { data: titles, error: titlesError } = await supabase
          .from("titles")
          .select("title_id:id, primary_title:title, release_year:year, poster_url, backdrop_url")
          .in("title_id", titleIds);

        if (!titlesError && titles) {
          titlesById = new Map((titles as TitleRow[]).map((t) => [t.id, t]));
        } else if (titlesError) {
          console.warn("[useDiaryTimeline] Failed to load titles", titlesError.message);
        }
      }

      return rows.map((row) => {
        const title = row.title_id ? (titlesById.get(row.title_id) ?? null) : null;
        const kind = mapEventTypeToDiaryKind(row.event_type);
        const payload = row.payload ?? {};

        return {
          id: row.id,
          createdAt: row.created_at,
          kind,
          titleId: row.title_id,
          title: title?.title ?? null,
          year: title?.year ?? null,
          posterUrl: title?.poster_url ?? title?.backdrop_url ?? null,
          rating: payload.rating ?? null,
          reviewSnippet: payload.review_snippet ?? null,
          headline: payload.headline ?? null,
          extra: payload.extra ?? null,
          emoji: payload.emoji ?? null,
        };
      });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null)?.message ?? null,
  };
};
