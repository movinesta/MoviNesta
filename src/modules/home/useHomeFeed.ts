import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";
import type { Database } from "@/types/supabase";
import type { AvatarColorKey, FeedTitle, FeedUser, HomeFeedItem } from "./homeFeedTypes";

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
type HomeFeedRow = Database["public"]["Functions"]["get_home_feed"]["Returns"][number];
type TitleRow = Database["public"]["Tables"]["titles"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const FEED_PAGE_SIZE = 40;

type ActivityPayload = ActivityEventRow["payload"];

interface NormalizedActivityPayload {
  rating?: number;
  review_snippet?: string;
  headline?: string;
  extra?: string;
  emoji?: string;
  reason?: string;
  score?: number;
}

const formatTimeAgo = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return `${diffWeeks} wk${diffWeeks === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} mo${diffMonths === 1 ? "" : "s"} ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} yr${diffYears === 1 ? "" : "s"} ago`;
};

const pickAvatarColor = (id: string): AvatarColorKey => {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) {
    sum += id.charCodeAt(i);
  }
  const idx = sum % 3;
  if (idx === 0) return "teal";
  if (idx === 1) return "violet";
  return "orange";
};

const buildAvatarInitials = (displayName?: string | null, username?: string | null): string => {
  const source = (displayName ?? username ?? "").trim();

  if (!source) {
    return "?";
  }

  const parts = source.split(/\s+/);

  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    const initials = (first + second).trim();
    return initials ? initials.toUpperCase() : "?";
  }

  const cleaned = parts[0].replace(/[^A-Za-z0-9]/g, "");
  if (!cleaned) {
    return "?";
  }

  if (cleaned.length === 1) {
    return cleaned.toUpperCase();
  }

  return (cleaned[0] + cleaned[cleaned.length - 1]).toUpperCase();
};

const normalizeActivityPayload = (payload: ActivityPayload): NormalizedActivityPayload => {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;

    return {
      rating: typeof record.rating === "number" ? record.rating : undefined,
      review_snippet: typeof record.review_snippet === "string" ? record.review_snippet : undefined,
      headline: typeof record.headline === "string" ? record.headline : undefined,
      extra: typeof record.extra === "string" ? record.extra : undefined,
      emoji: typeof record.emoji === "string" ? record.emoji : undefined,
      reason: typeof record.reason === "string" ? record.reason : undefined,
      score: typeof record.score === "number" ? record.score : undefined,
    };
  }

  return {};
};

const mapEventToFeedItem = (
  row: ActivityEventRow,
  profilesById: Map<string, ProfileRow>,
  titlesById: Map<string, TitleRow>,
): HomeFeedItem | null => {
  const profile = profilesById.get(row.user_id);
  if (!profile) return null;

  const payload = normalizeActivityPayload(row.payload);
  const titleRow = row.title_id ? titlesById.get(row.title_id) : null;
  if (!titleRow) return null;

  const title: FeedTitle = {
    id: row.title_id!,
    name: titleRow.primary_title ?? "Untitled",
    year: titleRow.release_year ?? new Date().getFullYear(),
    posterUrl: titleRow.poster_url ?? undefined,
    backdropUrl: titleRow.backdrop_url ?? null,
  };

  const user: FeedUser = {
    id: profile.id,
    displayName: profile.display_name ?? profile.username ?? "Someone",
    username: profile.username ?? profile.display_name ?? "",
    avatarInitials: buildAvatarInitials(profile.display_name, profile.username),
    avatarColor: pickAvatarColor(profile.id),
  };

  const base = {
    id: row.id,
    createdAt: row.created_at,
    createdAtLabel: formatTimeAgo(row.created_at),
  } as const;

  switch (row.event_type) {
    case "rating_created":
      if (typeof payload.rating !== "number") return null;
      return {
        ...base,
        kind: "friend-rating",
        user,
        title,
        rating: payload.rating,
        reviewSnippet: payload.review_snippet,
        emoji: payload.emoji,
      };
    case "review_created":
      return {
        ...base,
        kind: "friend-review",
        user,
        title,
        rating: payload.rating,
        reviewSnippet: payload.review_snippet ?? payload.headline,
        emoji: payload.emoji,
      };
    case "watchlist_added":
      return {
        ...base,
        kind: "watchlist-add",
        user,
        title,
        note: payload.extra ?? payload.headline,
      };
    case "watchlist_removed":
      return {
        ...base,
        kind: "watchlist-add",
        user,
        title,
      };
    default:
      return null;
  }
};

export const fetchHomeFeedPage = async (
  userId: string,
  cursor: string | null = null,
): Promise<{ items: HomeFeedItem[]; nextCursor: string | null; hasMore: boolean }> => {
  const { data: eventsData, error: eventsError } = await supabase.rpc("get_home_feed", {
    p_user_id: userId,
    p_limit: FEED_PAGE_SIZE,
    p_cursor: cursor,
  });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const rows = (eventsData as HomeFeedRow[] | null) ?? [];

  if (!rows.length) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;

  const titleIds = Array.from(
    new Set(pageRows.map((row) => row.title_id).filter((id): id is string => Boolean(id))),
  );

  const actorUserIds = Array.from(
    new Set(pageRows.map((row) => row.user_id).filter((value): value is string => Boolean(value))),
  );

  const [titlesResult, profilesResult] = await Promise.all([
    titleIds.length
      ? supabase
          .from("titles")
          .select("title_id, primary_title, release_year, poster_url, backdrop_url")
          .in("title_id", titleIds)
      : Promise.resolve({ data: [] as TitleRow[], error: null }),
    actorUserIds.length
      ? supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", actorUserIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
  ]);

  if (titlesResult.error) {
    console.warn("[useHomeFeed] Failed to load titles for feed", titlesResult.error.message);
  }

  if (profilesResult.error) {
    console.warn("[useHomeFeed] Failed to load profiles for feed", profilesResult.error.message);
  }

  const titlesById = new Map<string, TitleRow>();
  (titlesResult.data ?? []).forEach((row) => {
    titlesById.set(row.title_id, row);
  });

  const profilesById = new Map<string, ProfileRow>();
  (profilesResult.data ?? []).forEach((row) => {
    profilesById.set(row.id, row);
  });

  const items: HomeFeedItem[] = [];

  pageRows.forEach((row) => {
    const mapped = mapEventToFeedItem(row, profilesById, titlesById);
    if (mapped) {
      items.push(mapped);
    }
  });

  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.created_at ?? null) : null;

  return { items, nextCursor, hasMore };
};

export interface UseHomeFeedResult {
  items: HomeFeedItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
}

export const useHomeFeed = (): UseHomeFeedResult => {
  const { user } = useAuth();

  const { data, isLoading, isFetching, error, fetchNextPage, isFetchingNextPage, hasNextPage } =
    useInfiniteQuery<{ items: HomeFeedItem[]; nextCursor: string | null; hasMore: boolean }, Error>(
      {
        queryKey: qk.homeFeed(user?.id ?? null),
        enabled: Boolean(user?.id),
        initialPageParam: undefined,
        staleTime: 1000 * 30,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        queryFn: async ({ pageParam }) => {
          if (!user?.id) {
            return { items: [], nextCursor: null, hasMore: false };
          }
          return fetchHomeFeedPage(user.id, pageParam as string | null);
        },
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
      },
    );

  const items = (data?.pages ?? []).flatMap((page) => page.items ?? []);

  const friendlyError = error
    ? "We couldn’t load your feed right now. Check your connection or try signing in again."
    : null;

  const isInitialLoading = isLoading || (!data && isFetching);

  return {
    items,
    isLoading: isInitialLoading,
    isLoadingMore: isFetchingNextPage,
    hasMore: Boolean(hasNextPage),
    error: friendlyError,
    loadMore: () => {
      if (hasNextPage) {
        fetchNextPage();
      }
    },
  };
};
