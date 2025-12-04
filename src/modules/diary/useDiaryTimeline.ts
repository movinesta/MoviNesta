import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/types/supabase";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
type TitleRow = Pick<
  Database["public"]["Tables"]["titles"]["Row"],
  "title_id" | "primary_title" | "release_year" | "poster_url" | "backdrop_url"
>;

type RatingCreatedPayload = {
  event_type: "rating_created";
  rating: number;
  headline?: string;
  emoji?: string;
};

type ReviewCreatedPayload = {
  event_type: "review_created";
  review_snippet?: string;
  rating?: number;
  headline?: string;
  emoji?: string;
};

type WatchlistPayload = {
  event_type: "watchlist_added" | "watchlist_removed";
  extra?: string;
};

type FollowCreatedPayload = {
  event_type: "follow_created";
  extra?: string;
};

type CommentOrReplyPayload = {
  event_type: "comment_created" | "reply_created";
  extra?: string;
};

type ListActivityPayload = {
  event_type: "list_created" | "list_item_added";
  extra?: string;
};

type MessageSentPayload = {
  event_type: "message_sent";
  extra?: string;
};

type ActivityEventPayload =
  | RatingCreatedPayload
  | ReviewCreatedPayload
  | WatchlistPayload
  | FollowCreatedPayload
  | CommentOrReplyPayload
  | ListActivityPayload
  | MessageSentPayload;

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

const parseString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const parseNumber = (value: unknown): number | undefined => {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const validateActivityPayload = (
  eventType: ActivityEventRow["event_type"],
  payload: ActivityEventRow["payload"],
): ActivityEventPayload | null => {
  if (!payload || typeof payload !== "object") return null;

  const payloadObject = payload as Record<string, unknown>;

  switch (eventType) {
    case "rating_created": {
      const rating = parseNumber(payloadObject.rating);
      if (rating === undefined) return null;
      return {
        event_type: eventType,
        rating,
        headline: parseString(payloadObject.headline),
        emoji: parseString(payloadObject.emoji),
      } satisfies RatingCreatedPayload;
    }
    case "review_created": {
      return {
        event_type: eventType,
        rating: parseNumber(payloadObject.rating),
        review_snippet: parseString(payloadObject.review_snippet),
        headline: parseString(payloadObject.headline),
        emoji: parseString(payloadObject.emoji),
      } satisfies ReviewCreatedPayload;
    }
    case "watchlist_added":
    case "watchlist_removed": {
      return {
        event_type: eventType,
        extra: parseString(payloadObject.extra),
      } satisfies WatchlistPayload;
    }
    case "follow_created": {
      return {
        event_type: eventType,
        extra: parseString(payloadObject.extra),
      } satisfies FollowCreatedPayload;
    }
    case "comment_created":
    case "reply_created": {
      return {
        event_type: eventType,
        extra: parseString(payloadObject.extra),
      } satisfies CommentOrReplyPayload;
    }
    case "list_created":
    case "list_item_added": {
      return {
        event_type: eventType,
        extra: parseString(payloadObject.extra),
      } satisfies ListActivityPayload;
    }
    case "message_sent": {
      return {
        event_type: eventType,
        extra: parseString(payloadObject.extra),
      } satisfies MessageSentPayload;
    }
    default:
      return null;
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
        const payload = validateActivityPayload(row.event_type, row.payload);

        return {
          id: row.id,
          createdAt: row.created_at,
          kind,
          titleId: row.title_id,
          title: title?.primary_title ?? null,
          year: title?.release_year ?? null,
          posterUrl: title?.poster_url ?? title?.backdrop_url ?? null,
          rating: payload?.event_type === "rating_created"
            ? payload.rating
            : payload?.event_type === "review_created"
              ? payload.rating ?? null
              : null,
          reviewSnippet: payload?.event_type === "review_created" ? payload.review_snippet ?? null : null,
          headline:
            payload?.event_type === "rating_created" || payload?.event_type === "review_created"
              ? payload.headline ?? null
              : null,
          extra: payload?.extra ?? null,
          emoji:
            payload?.event_type === "rating_created" || payload?.event_type === "review_created"
              ? payload.emoji ?? null
              : null,
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
