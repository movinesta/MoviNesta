import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { mapMediaItemToSummary } from "@/lib/mediaItems";
import { tmdbImageUrl } from "@/lib/tmdb";
import type { Json } from "@/types/supabase";

import { useAuth } from "../auth/AuthProvider";
import {
  fetchMediaSwipeDeck,
  getOrCreateMediaSwipeSessionId,
  getOrCreateSwipeDeckSeedForMode,
  type MediaSwipeCard,
} from "../swipe/mediaSwipeApi";

type HomeFeedRow = {
  id: string;
  created_at: string;
  user_id: string;
  event_type: string;
  actor_profile?: Json | null;
  media_item?: Json | null;
  media_item_id?: string | null;
  payload?: Json | null;
};

export type DiscoverPoster = {
  id: string;
  title: string;
  imageUrl: string | null;
  ratingLabel: string | null;
  subtitle: string | null;
  friendAvatarUrls: string[];
  friendExtraCount: number;
};

export type CuratedListCard = {
  id: string;
  name: string;
  description: string | null;
  owner: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  coverUrl: string | null;
};

function formatImdbAsLabel(imdbRating: number | null | undefined): string | null {
  if (typeof imdbRating !== "number" || !Number.isFinite(imdbRating)) return null;
  return imdbRating.toFixed(1);
}

function cardToDiscoverPoster(card: MediaSwipeCard | null | undefined): DiscoverPoster | null {
  const id = (card?.mediaItemId ?? "").toString();
  const title = (card?.title ?? "").toString().trim();
  if (!id || !title) return null;

  const imageUrl =
    (card?.posterUrl && card.posterUrl.trim() ? card.posterUrl : null) ??
    (card?.tmdbPosterPath ? tmdbImageUrl(card.tmdbPosterPath, "w500") : null);

  return {
    id,
    title,
    imageUrl,
    ratingLabel: formatImdbAsLabel(card?.imdbRating ?? null),
    subtitle: card?.why ? String(card.why) : null,
    friendAvatarUrls: (card?.friendProfiles ?? [])
      .map((p) => (p?.avatar_url ? String(p.avatar_url) : null))
      .filter((v): v is string => Boolean(v))
      .slice(0, 3),
    friendExtraCount: Math.max(0, ((card?.friendProfiles ?? []).length || 0) - 3),
  };
}

function rowToDiscoverPoster(
  row: HomeFeedRow,
  actorAvatarUrl: string | null,
): DiscoverPoster | null {
  const title = mapMediaItemToSummary(row.media_item as any);
  const id = title.id;
  if (!id || !title.title) return null;

  const imageUrl = title.posterUrl ?? title.backdropUrl ?? null;
  const ratingLabel = formatImdbAsLabel(title.imdbRating ?? null);

  return {
    id,
    title: title.title,
    imageUrl,
    ratingLabel,
    subtitle: null,
    friendAvatarUrls: actorAvatarUrl ? [actorAvatarUrl] : [],
    friendExtraCount: 0,
  };
}

export function useSearchTrendingNow(limit = 10) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

const fetchFallbackFromLibrary = async (): Promise<DiscoverPoster[]> => {
  // Fallback feed that doesn't rely on the swipe-deck Edge Function.
  //
  // Priority:
  // 1) Use server-computed trending scores (72h) if available.
  // 2) Fall back to TMDb popularity stored on media_items.
  //
  // This keeps “Trending Now” from looking empty for new accounts or when the Edge Function is unavailable.

  // NOTE: Column list is intentionally aligned with mapMediaItemToSummary().
  const columns = `
    id,
    kind,
    tmdb_id,
    tmdb_title,
    tmdb_name,
    tmdb_original_title,
    tmdb_original_name,
    tmdb_release_date,
    tmdb_first_air_date,
    tmdb_poster_path,
    tmdb_backdrop_path,
    tmdb_original_language,
    tmdb_genre_ids,
    tmdb_vote_average,
    tmdb_vote_count,
    tmdb_popularity,
    omdb_title,
    omdb_year,
    omdb_language,
    omdb_imdb_id,
    omdb_imdb_rating,
    omdb_rating_rotten_tomatoes,
    omdb_poster,
    omdb_rated
  `;

  const coerceUuid = (value: any): string | null => {
    if (!value) return null;
    const s = String(value).trim();
    return s ? s : null;
  };

  // 1) Try the server-computed trending view first.
  try {
    const { data: trendRows, error: trendErr } = await supabase
      .from("media_item_trending_72h")
      .select("media_item_id, trend_score")
      .order("trend_score", { ascending: false })
      .limit(Math.max(10, Math.min(limit * 6, 80)));

    if (!trendErr && Array.isArray(trendRows) && trendRows.length) {
      const scoreById = new Map<string, number>();
      const ids: string[] = [];
      for (const row of trendRows as any[]) {
        const id = coerceUuid((row as any)?.media_item_id);
        if (!id) continue;
        const score = Number((row as any)?.trend_score ?? 0);
        if (!scoreById.has(id)) ids.push(id);
        scoreById.set(id, Number.isFinite(score) ? score : 0);
        if (ids.length >= Math.max(10, Math.min(limit * 4, 40))) break;
      }

      if (ids.length) {
        const { data, error } = await supabase
          .from("media_items")
          .select(columns)
          .in("id", ids)
          .in("kind", ["movie", "series"])
          .limit(ids.length);

        if (!error && Array.isArray(data) && data.length) {
          const rows = data as any[];
          const posters = rows
            .map((row) => {
              const summary = mapMediaItemToSummary(row as any);
              if (!summary?.id || !summary?.title) return null;
              return {
                id: summary.id,
                title: summary.title,
                imageUrl: summary.posterUrl ?? summary.backdropUrl ?? null,
                ratingLabel: formatImdbAsLabel(summary.imdbRating ?? null),
                subtitle: null,
                friendAvatarUrls: [],
                friendExtraCount: 0,
                _score: scoreById.get(summary.id) ?? 0,
              } as DiscoverPoster & { _score: number };
            })
            .filter(Boolean) as (DiscoverPoster & { _score: number })[];

          posters.sort((a, b) => b._score - a._score);
          return posters.slice(0, Math.max(1, Math.min(limit, 24))).map(({ _score, ...p }) => p);
        }

        if (error) {
          console.warn("[search.discover] trending view -> media_items lookup failed", error);
        }
      }
    }

    if (trendErr) {
      console.warn("[search.discover] trending view unavailable", trendErr);
    }
  } catch (err) {
    console.warn("[search.discover] trending view fallback threw", err);
  }

  // 2) Popularity fallback from library (may be blocked by RLS for anon; return [] in that case).
  const { data, error } = await supabase
    .from("media_items")
    .select(columns)
    .in("kind", ["movie", "series"])
    .order("tmdb_popularity", { ascending: false, nullsFirst: false })
    .order("tmdb_vote_count", { ascending: false, nullsFirst: false })
    .order("tmdb_vote_average", { ascending: false, nullsFirst: false })
    .order("tmdb_release_date", { ascending: false, nullsFirst: false })
    .order("tmdb_first_air_date", { ascending: false, nullsFirst: false })
    .limit(Math.max(1, Math.min(limit, 24)));

  if (error) {
    console.warn("[search.discover] popularity fallback trending query failed", error);
    return [];
  }

  const rows = (Array.isArray(data) ? data : []) as any[];
  return rows
    .map((row) => {
      const summary = mapMediaItemToSummary(row as any);
      if (!summary?.id || !summary?.title) return null;
      return {
        id: summary.id,
        title: summary.title,
        imageUrl: summary.posterUrl ?? summary.backdropUrl ?? null,
        ratingLabel: formatImdbAsLabel(summary.imdbRating ?? null),
        subtitle: null,
        friendAvatarUrls: [],
        friendExtraCount: 0,
      } satisfies DiscoverPoster;
    })
    .filter((v): v is DiscoverPoster => Boolean(v));
};
;

  return useQuery({
    queryKey: ["search", "discover", "trending", userId ?? "anon", limit],
    // Allow trending to work for signed-out users too (fallback may still return results).
    enabled: true,
    staleTime: 1000 * 60 * 10,
    retry: 1,
    retryDelay: 750,
    queryFn: async () => {
      // Always read the latest session id from storage (it can be rotated on INVALID_SESSION).
      // Prefer the swipe deck (personalized / reranked). If it errors or returns empty, fall back.
      try {
        const sessionId = getOrCreateMediaSwipeSessionId();
        const seed = getOrCreateSwipeDeckSeedForMode(sessionId, "trending", null);
        const deck = await fetchMediaSwipeDeck({ sessionId, mode: "trending", limit, seed });
        const posters = deck.cards
          .map(cardToDiscoverPoster)
          .filter((v): v is DiscoverPoster => Boolean(v));
        if (posters.length) return posters;
      } catch (err) {
        console.warn("[search.discover] trending deck failed, falling back", err);
      }

      // Fallback to a popularity-based selection from the library.
      return await fetchFallbackFromLibrary();
    },
  });
}

function normalizeActorProfile(raw: any): { id: string; avatarUrl: string | null } {
  const id = (raw?.id ?? "").toString();
  const avatarUrl = raw?.avatar_url ? String(raw.avatar_url) : null;
  return { id, avatarUrl };
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

export function useSearchFriendsAreWatching(limit = 8) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const q = useQuery({
    queryKey: ["search", "discover", "friends", userId, limit],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!userId) return [] as DiscoverPoster[];

      const { data, error } = await supabase.rpc("get_home_feed_v2", {
        p_user_id: userId,
        p_limit: 200,
        p_cursor_created_at: null,
        p_cursor_id: null,
      });

      if (error) throw new Error(error.message);
      const rows: HomeFeedRow[] = (Array.isArray(data) ? data : []).filter(isHomeFeedRow);

      // Only friends activity (exclude current user).
      const friendRows = rows.filter(
        (r) => r.user_id !== userId && typeof r.media_item_id === "string" && r.media_item_id,
      );

      // Aggregate by title.
      const byTitle = new Map<
        string,
        {
          row: HomeFeedRow;
          users: Map<string, string | null>; // id -> avatar
          watched: number;
          watchlist: number;
          rated: number;
        }
      >();

      for (const r of friendRows) {
        const mediaId = r.media_item_id ?? "";
        if (!mediaId) continue;

        const actor = normalizeActorProfile(r.actor_profile);
        const userKey = actor.id || r.user_id;

        const cur = byTitle.get(mediaId) ?? {
          row: r,
          users: new Map<string, string | null>(),
          watched: 0,
          watchlist: 0,
          rated: 0,
        };

        // Track most recent row for title card metadata.
        if (new Date(r.created_at).getTime() > new Date(cur.row.created_at).getTime()) {
          cur.row = r;
        }

        if (userKey) cur.users.set(userKey, actor.avatarUrl ?? null);

        if (r.event_type === "watched") cur.watched += 1;
        if (r.event_type === "watchlist_added") cur.watchlist += 1;
        if (r.event_type === "rating_created") cur.rated += 1;

        byTitle.set(mediaId, cur);
      }

      const scored = Array.from(byTitle.values())
        .map((agg) => {
          const total = agg.users.size;
          const poster = rowToDiscoverPoster(agg.row, null);
          if (!poster) return null;

          // Attach avatar stack.
          const avatarUrls = Array.from(agg.users.values()).filter(
            (v): v is string => typeof v === "string" && v.trim().length > 0,
          );
          poster.friendAvatarUrls = avatarUrls.slice(0, 3);
          poster.friendExtraCount = Math.max(0, total - 3);

          // Subtitle: prefer watched, then watchlist, then rated.
          if (agg.watched > 0) {
            poster.subtitle = `${agg.watched} friend${agg.watched === 1 ? "" : "s"} watched`;
          } else if (agg.watchlist > 0) {
            poster.subtitle = `${agg.watchlist} friend${agg.watchlist === 1 ? "" : "s"} added to watchlist`;
          } else if (agg.rated > 0) {
            poster.subtitle = `${agg.rated} friend${agg.rated === 1 ? "" : "s"} rated`;
          } else {
            poster.subtitle = `${total} friend${total === 1 ? "" : "s"} active`;
          }

          return { poster, total };
        })
        .filter((v): v is { poster: DiscoverPoster; total: number } => Boolean(v))
        .sort((a, b) => b.total - a.total)
        .slice(0, limit)
        .map((v) => v.poster);

      return scored;
    },
  });

  return q;
}

export function useSearchCuratedLists(limit = 8) {
  const { user } = useAuth();
  const enabled = Boolean(user?.id);

  return useQuery({
    queryKey: ["search", "discover", "curated_lists", limit],
    enabled,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data: lists, error } = await supabase
        .from("lists")
        .select("id, name, description, user_id, updated_at")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      const listRows = (lists ?? []) as Array<{
        id: string;
        name: string;
        description: string | null;
        user_id: string;
      }>;

      const listIds = listRows.map((l) => l.id);
      const userIds = Array.from(new Set(listRows.map((l) => l.user_id)));

      const [{ data: profiles, error: profilesError }, { data: items, error: itemsError }] =
        await Promise.all([
          supabase
            .from("profiles_public")
            .select("id, username, display_name, avatar_url")
            .in("id", userIds),
          supabase
            .from("list_items")
            .select(
              `list_id, title_id, position,
               media_items: title_id (
                 id,
                 omdb_poster,
                 tmdb_poster_path,
                 tmdb_backdrop_path,
                 tmdb_title,
                 tmdb_name,
                 tmdb_release_date,
                 tmdb_first_air_date,
                 tmdb_original_language,
                 kind,
                 omdb_imdb_rating,
                 omdb_rating_rotten_tomatoes
               )`,
            )
            .in("list_id", listIds)
            .order("position", { ascending: true })
            .limit(limit * 6),
        ]);

      if (profilesError) throw new Error(profilesError.message);
      if (itemsError) throw new Error(itemsError.message);

      const profileById = new Map<string, any>();
      for (const p of profiles ?? []) {
        profileById.set((p as any).id, p);
      }

      const firstItemByList = new Map<string, any>();
      for (const it of items ?? []) {
        const listId = (it as any).list_id;
        if (!listId || firstItemByList.has(listId)) continue;
        firstItemByList.set(listId, it);
      }

      const cards: CuratedListCard[] = listRows.map((l) => {
        const ownerRaw = profileById.get(l.user_id) ?? null;
        const displayName =
          (ownerRaw?.display_name?.toString().trim() || ownerRaw?.username?.toString().trim()) ??
          "Someone";

        const coverItem = firstItemByList.get(l.id) as any;
        const coverRow = coverItem?.media_items ?? null;
        const summary = coverRow ? mapMediaItemToSummary(coverRow) : null;
        const coverUrl = summary?.posterUrl ?? summary?.backdropUrl ?? null;

        return {
          id: l.id,
          name: l.name,
          description: l.description,
          owner: {
            id: l.user_id,
            displayName,
            avatarUrl: ownerRaw?.avatar_url ? String(ownerRaw.avatar_url) : null,
          },
          coverUrl,
        };
      });

      return cards;
    },
  });
}

export function useDiscoverGenres() {
  return useMemo(
    () =>
      [
        { key: "action", label: "Action", tmdbGenreId: 28 },
        { key: "drama", label: "Drama", tmdbGenreId: 18 },
        { key: "horror", label: "Horror", tmdbGenreId: 27 },
        { key: "sci-fi", label: "Sci‑Fi", tmdbGenreId: 878 },
        { key: "comedy", label: "Comedy", tmdbGenreId: 35 },
        { key: "documentary", label: "Docu", tmdbGenreId: 99 },
      ] as const,
    [],
  );
}
