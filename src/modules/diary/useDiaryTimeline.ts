import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/types/supabase";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
type TitleRow = Pick<
  Database["public"]["Tables"]["titles"]["Row"],
  "title_id" | "primary_title" | "release_year" | "poster_url" | "backdrop_url"
>;

interface ActivityPayload {
  rating?: number;
  review_snippet?: string;
  headline?: string;
  extra?: string;
  emoji?: string;
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

const mapEventTypeToDiaryKind = (eventType: ActivityEventRow["event_type"]): DiaryEventKind => {
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

const parseActivityPayload = (payload: ActivityEventRow["payload"]): ActivityPayload => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const payloadObject = payload as Record<string, unknown>;

  return {
    rating: typeof payloadObject.rating === "number" ? payloadObject.rating : undefined,
    review_snippet:
      typeof payloadObject.review_snippet === "string"
        ? payloadObject.review_snippet
        : undefined,
    headline: typeof payloadObject.headline === "string" ? payloadObject.headline : undefined,
    extra: typeof payloadObject.extra === "string" ? payloadObject.extra : undefined,
    emoji: typeof payloadObject.emoji === "string" ? payloadObject.emoji : undefined,
  };
};

export const useDiaryTimeline = (userIdOverride?: string | null) => {
  const { user } = useAuth();
  const userId = userIdOverride ?? user?.id ?? null;

  const query = useQuery({
    queryKey: ["diary", "timeline", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<DiaryTimelineItem[]> => {
      if (!userId) return [];

      const { data: rows, error } = await supabase
        .from("activity_events")
        .select("id, created_at, event_type, title_id, payload")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }

      if (!rows?.length) return [];

      const titleIds = Array.from(
        new Set(rows.map((row) => row.title_id).filter((id): id is string => Boolean(id))),
      );

      let titlesById = new Map<string, TitleRow>();

      if (titleIds.length) {
        const { data: titles, error: titlesError } = await supabase
          .from("titles")
          .select("title_id, primary_title, release_year, poster_url, backdrop_url")
          .in("title_id", titleIds);

        if (!titlesError && titles) {
          titlesById = new Map(titles.map((title) => [title.title_id, title]));
        } else if (titlesError) {
          console.warn("[useDiaryTimeline] Failed to load titles", titlesError.message);
        }
      }

      return rows.map((row) => {
        const title = row.title_id ? (titlesById.get(row.title_id) ?? null) : null;
        const kind = mapEventTypeToDiaryKind(row.event_type);
        const payload = parseActivityPayload(row.payload);

        return {
          id: row.id,
          createdAt: row.created_at,
          kind,
          titleId: row.title_id,
          title: title?.primary_title ?? null,
          year: title?.release_year ?? null,
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
    error: query.error instanceof Error ? query.error.message : null,
  };
};
