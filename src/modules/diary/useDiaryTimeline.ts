import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/types/supabase";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";
import { rating0_10ToStars } from "@/lib/ratings";

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
type TitleRow = ReturnType<typeof mapMediaItemToSummary>;

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string => {
  return typeof value === "string" && UUID_REGEX.test(value);
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
        .select("id, created_at, event_type, title_id, media_item_id, payload")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }

      if (!rows?.length) return [];

      const mediaItemIds = Array.from(
        new Set(
          rows
            .map((row) => row.media_item_id ?? (isUuid(row.title_id) ? row.title_id : null))
            .filter((id): id is string => Boolean(id)),
        ),
      );

      let titlesById = new Map<string, TitleRow>();

      if (mediaItemIds.length) {
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
          .in("id", mediaItemIds);

        if (!titlesError && titles) {
          titlesById = new Map(
            (titles as MediaItemRow[]).map((title) => [title.id, mapMediaItemToSummary(title)]),
          );
        } else if (titlesError) {
          console.warn("[useDiaryTimeline] Failed to load titles", titlesError.message);
        }
      }

      return rows.map((row) => {
        const resolvedTitleId =
          row.media_item_id ?? (isUuid(row.title_id) ? row.title_id : null);
        const title = resolvedTitleId ? (titlesById.get(resolvedTitleId) ?? null) : null;
        const kind = mapEventTypeToDiaryKind(row.event_type);
        const payload = validateActivityPayload(row.event_type, row.payload);

        return {
          id: row.id,
          createdAt: row.created_at,
          kind,
          titleId: resolvedTitleId ?? null,
          title: title?.title ?? null,
          year: title?.year ?? null,
          posterUrl: title?.posterUrl ?? title?.backdropUrl ?? null,
          rating:
            payload?.event_type === "rating_created"
              ? rating0_10ToStars(payload.rating)
              : payload?.event_type === "review_created"
                ? rating0_10ToStars(payload.rating ?? null)
                : null,
          reviewSnippet:
            payload?.event_type === "review_created" ? (payload.review_snippet ?? null) : null,
          headline:
            payload?.event_type === "rating_created" || payload?.event_type === "review_created"
              ? (payload.headline ?? null)
              : null,
          extra: (payload as any)?.extra ?? null,
          emoji:
            payload?.event_type === "rating_created" || payload?.event_type === "review_created"
              ? (payload.emoji ?? null)
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
