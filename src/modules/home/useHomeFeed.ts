// src/modules/home/useHomeFeed.ts
//
// Home feed hook backed by `public.get_home_feed_v2`.
// Return shape matches what HomeFeedTab expects.

import { useInfiniteQuery } from "@tanstack/react-query";

import { mapMediaItemToSummary } from "@/lib/mediaItems";
import { qk } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

import { useAuth } from "../auth/AuthProvider";
import { formatTimeAgo } from "../messages/formatTimeAgo";
import type { AvatarColorKey, FeedTitle, FeedUser, HomeFeedItem } from "./homeFeedTypes";
import { rating0_10ToStars } from "@/lib/ratings";

type HomeFeedRow = Database["public"]["Functions"]["get_home_feed_v2"]["Returns"][number];
type MediaItemRow = Database["public"]["Tables"]["media_items"]["Row"];

type FeedCursor = {
  createdAt: string | null;
  id: string | null;
};

// Backwards-compatible cursor encoding used by AuthProvider prefetch.
//
// - Legacy cursor: just an ISO timestamp (created_at).
// - Current cursor: "<created_at>|<event_id>" for stable pagination.
function parseCursorString(cursor: string | null): FeedCursor | null {
  if (!cursor) return null;

  const raw = cursor.toString();
  const [createdAt, id] = raw.split("|");

  if (!createdAt) return null;
  return {
    createdAt,
    id: id || null,
  };
}

function serializeCursor(cursor: FeedCursor | null): string | null {
  if (!cursor?.createdAt) return null;
  if (cursor.id) {
    return `${cursor.createdAt}|${cursor.id}`;
  }
  return cursor.createdAt;
}

type ActorProfileJson = {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

const PAGE_SIZE = 40;
const AVATAR_COLORS: AvatarColorKey[] = ["teal", "violet", "orange"];

function stableColorFromId(id: string): AvatarColorKey {
  // Simple deterministic hash.
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function normalizeActorProfile(raw: unknown, fallbackUserId: string): FeedUser {
  const actor = (raw ?? {}) as ActorProfileJson;
  const id = actor.id ?? fallbackUserId;

  const displayName =
    actor.display_name?.toString().trim() || actor.username?.toString().trim() || "Someone";

  const avatarUrl = actor.avatar_url?.toString().trim() || null;

  return {
    id,
    displayName,
    avatarUrl,
    avatarColor: stableColorFromId(id),
  };
}

function normalizeTitle(raw: unknown): FeedTitle | null {
  if (!raw || typeof raw !== "object") return null;

  const summary = mapMediaItemToSummary(raw as MediaItemRow);

  return {
    id: summary.id,
    name: summary.title,
    posterUrl: summary.posterUrl ?? summary.backdropUrl ?? null,
    mediaType: summary.type ?? "movie",
    year: summary.year ?? null,
    subtitle: summary.subtitle ?? null,
    backdropUrl: summary.backdropUrl ?? null,
  };
}

function extractNumber(payload: any, keys: string[]): number | null {
  if (!payload || typeof payload !== "object") return null;

  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const parsed = Number(v);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function extractString(payload: any, keys: string[]): string | null {
  if (!payload || typeof payload !== "object") return null;

  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  return null;
}

function rowToFeedItem(row: HomeFeedRow): HomeFeedItem | null {
  const createdAt = row.created_at;
  const relativeTime = formatTimeAgo(createdAt) ?? "";

  const user = normalizeActorProfile(row.actor_profile, row.user_id);
  const title = normalizeTitle(row.media_item);

  // Some events (e.g., follow_created) don't have a media item.
  if (!title) return null;

  const payload = row.payload as any;

  switch (row.event_type) {
    case "rating_created": {
      const rating = rating0_10ToStars(
        extractNumber(payload, ["rating", "score", "value"]) ?? null,
      );
      if (rating == null) return null;

      return {
        kind: "friend-rating",
        id: row.id,
        user,
        createdAt,
        relativeTime,
        title,
        rating,
        reviewSnippet:
          extractString(payload, ["reviewSnippet", "review", "snippet", "body", "text"]) ??
          undefined,
        emoji: extractString(payload, ["emoji", "icon"]) ?? undefined,
      };
    }

    case "review_created": {
      const reviewSnippet =
        extractString(payload, ["reviewSnippet", "review", "snippet", "body", "text"]) ?? "";
      const rating = rating0_10ToStars(
        extractNumber(payload, ["rating", "score", "value"]) ?? null,
      );

      return {
        kind: "friend-review",
        id: row.id,
        user,
        createdAt,
        relativeTime,
        title,
        rating: rating ?? undefined,
        reviewSnippet,
        emoji: extractString(payload, ["emoji", "icon"]) ?? undefined,
      };
    }

    case "watchlist_added": {
      return {
        kind: "watchlist-add",
        id: row.id,
        user,
        createdAt,
        relativeTime,
        title,
        note: extractString(payload, ["note", "message", "extra"]) ?? undefined,
      };
    }

    case "watchlist_removed": {
      return {
        kind: "watchlist-remove",
        id: row.id,
        user,
        createdAt,
        relativeTime,
        title,
      };
    }

    case "list_item_added": {
      const blurb = extractString(payload, ["blurb", "note", "message"]) ?? undefined;

      return {
        kind: "recommendation",
        id: row.id,
        user,
        createdAt,
        relativeTime,
        title,
        reason: blurb,
      };
    }

    default:
      return null;
  }
}

async function fetchHomeFeedPageV2(userId: string, cursor: FeedCursor | null) {
  const { data, error } = await supabase.rpc("get_home_feed_v2", {
    p_user_id: userId,
    p_limit: PAGE_SIZE,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as HomeFeedRow[];

  // The SQL function fetches `limit + 1` rows so we can detect if there is another page.
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const items = pageRows.map(rowToFeedItem).filter(Boolean) as HomeFeedItem[];
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last ? { createdAt: last.created_at, id: last.id } : null;

  return { items, nextCursor, hasMore };
}

// Exported for AuthProvider prefetch + any legacy callsites.
export async function fetchHomeFeedPage(
  userId: string,
  cursor: string | null = null,
): Promise<{ items: HomeFeedItem[]; nextCursor: string | null; hasMore: boolean }> {
  const parsed = parseCursorString(cursor);
  const page = await fetchHomeFeedPageV2(userId, parsed);

  return {
    items: page.items,
    nextCursor: serializeCursor(page.nextCursor),
    hasMore: page.hasMore,
  };
}

export function useHomeFeed() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useInfiniteQuery({
    queryKey: qk.homeFeed(userId),
    enabled: Boolean(userId),
    // Keep pageParam as a string cursor so AuthProvider prefetch and the UI hook share the same cache shape.
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchHomeFeedPage(userId as string, (pageParam as string | null) ?? null),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 60 * 1000,
  });

  const items = (query.data?.pages ?? []).flatMap((page) => page.items);

  const errorMessage =
    query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null;

  return {
    items,
    isLoading: query.isPending,
    error: errorMessage,
    hasMore: Boolean(query.hasNextPage),
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}
