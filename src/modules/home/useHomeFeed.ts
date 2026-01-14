// src/modules/home/useHomeFeed.ts
//
// Home feed hook backed by `public.get_home_feed_v2`.
// Return shape matches what HomeFeedTab expects.

import { useInfiniteQuery } from "@tanstack/react-query";

import { mapMediaItemToSummary } from "@/lib/mediaItems";
import { qk } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/supabase";
import { useAuth } from "../auth/AuthProvider";
import { formatTimeAgo } from "../messages/formatTimeAgo";
import type { AvatarColorKey, FeedTitle, FeedUser, HomeFeedItem } from "./homeFeedTypes";
import { rating0_10ToStars } from "@/lib/ratings";

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

  // optional (if the SQL function includes these fields in actor_profile)
  is_verified?: boolean | null;
  verified_type?: string | null;
  verified_label?: string | null;
  verified_at?: string | null;
  verified_by_org?: string | null;
};

type HomeFeedRow = {
  id: string;
  created_at: string;
  user_id: string;
  event_type: string;
  actor_profile?: Json | null;
  media_item?: Json | null;
  payload?: Json | null;
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

    // if present in actor_profile JSON (optional)
    isVerified: typeof actor.is_verified === "boolean" ? actor.is_verified : null,
    verifiedType: actor.verified_type ?? null,
    verifiedLabel: actor.verified_label ?? null,
    verifiedAt: actor.verified_at ?? null,
    verifiedOrg: actor.verified_by_org ?? null,
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
    subtitle: null,
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

    case "watched": {
      return {
        kind: "friend-watched",
        id: row.id,
        user,
        createdAt,
        relativeTime,
        title,
        // rating may be merged in client if a nearby rating_created exists
        rating:
          rating0_10ToStars(extractNumber(payload, ["rating", "score", "value"]) ?? null) ??
          undefined,
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

function isHomeFeedRow(value: unknown): value is HomeFeedRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.created_at === "string" &&
    typeof row.user_id === "string" &&
    typeof row.event_type === "string"
  );
}

function mergeWatchedAndRating(items: HomeFeedItem[]): HomeFeedItem[] {
  const out: HomeFeedItem[] = [];
  const windowMs = 2 * 60 * 1000;

  const parse = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  };

  for (let i = 0; i < items.length; i += 1) {
    const cur = items[i];
    const next = items[i + 1];

    if (!next) {
      out.push(cur);
      continue;
    }

    const curT = parse(cur.createdAt);
    const nextT = parse(next.createdAt);

    const sameActor = cur.user.id === next.user.id;
    const sameTitle = cur.title.id === next.title.id;
    const close = Math.abs(curT - nextT) <= windowMs;

    const pair1 = cur.kind === "friend-watched" && next.kind === "friend-rating";
    const pair2 = cur.kind === "friend-rating" && next.kind === "friend-watched";

    if (sameActor && sameTitle && close && (pair1 || pair2)) {
      const watched = (pair1 ? cur : next) as any;
      const rating = (pair1 ? next : cur) as any;

      const merged: any = {
        ...watched,
        kind: "friend-watched",
        rating: typeof watched.rating === "number" ? watched.rating : rating.rating,
        // keep the most recent timestamp for display
        createdAt: curT >= nextT ? cur.createdAt : next.createdAt,
        relativeTime: curT >= nextT ? cur.relativeTime : next.relativeTime,
      };

      out.push(merged);
      i += 1;
      continue;
    }

    out.push(cur);
  }

  return out;
}


async function enrichFeedUsersWithVerification(items: HomeFeedItem[]): Promise<HomeFeedItem[]> {
  // If items already have verification, no need to fetch.
  const missing = new Set<string>();
  for (const it of items) {
    const u = (it as any).user as FeedUser | undefined;
    if (!u?.id) continue;
    if (u.isVerified === null || typeof u.isVerified === "undefined") {
      missing.add(u.id);
    }
  }

  if (missing.size === 0) return items;

  const ids = Array.from(missing);
  const { data, error } = await supabase
    .from("profiles_public")
    .select("id,is_verified,verified_type,verified_label,verified_at,verified_by_org")
    .in("id", ids);

  if (error || !data) return items;

  const map = new Map<string, any>();
  for (const row of data) {
    if (!row?.id) continue;
    map.set(row.id, row);
  }

  return items.map((it) => {
    const user = (it as any).user as FeedUser;
    const row = map.get(user.id);
    if (!row) return it;
    return {
      ...it,
      user: {
        ...user,
        isVerified: row.is_verified ?? null,
        verifiedType: row.verified_type ?? null,
        verifiedLabel: row.verified_label ?? null,
        verifiedAt: row.verified_at ?? null,
        verifiedOrg: row.verified_by_org ?? null,
      },
    } as HomeFeedItem;
  });
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

  const rows: HomeFeedRow[] = (Array.isArray(data) ? data : []).filter(isHomeFeedRow);

  // The SQL function fetches `limit + 1` rows so we can detect if there is another page.
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows: HomeFeedRow[] = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const rawItems = pageRows.map(rowToFeedItem).filter(Boolean) as HomeFeedItem[];
  const items = await enrichFeedUsersWithVerification(mergeWatchedAndRating(rawItems));
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
