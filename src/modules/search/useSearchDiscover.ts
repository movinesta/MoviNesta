import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { mapMediaItemToSummary } from "@/lib/mediaItems";
import { tmdbImageUrl } from "@/lib/tmdb";

import type { Database } from "@/types/supabase";
import { useAuth } from "../auth/AuthProvider";
import {
  fetchMediaSwipeDeck,
  getOrCreateSwipeDeckSeedForMode,
  type MediaSwipeCard,
} from "../swipe/mediaSwipeApi";

type HomeFeedRow = Database["public"]["Functions"]["get_home_feed_v2"]["Returns"][number];

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
  actorId: string,
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
  const { session } = useAuth();

  return useQuery({
    queryKey: ["search", "discover", "trending", session?.user?.id ?? "anon", limit],
    enabled: Boolean(session?.user?.id),
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const sessionId = `search_v2_${session?.user?.id ?? "anon"}`;
      const seed = getOrCreateSwipeDeckSeedForMode(sessionId, "trending", null);
      const deck = await fetchMediaSwipeDeck({ sessionId, mode: "trending", limit, seed });
      return deck.cards.map(cardToDiscoverPoster).filter((v): v is DiscoverPoster => Boolean(v));
    },
  });
}

function normalizeActorProfile(raw: any): { id: string; avatarUrl: string | null } {
  const id = (raw?.id ?? "").toString();
  const avatarUrl = raw?.avatar_url ? String(raw.avatar_url) : null;
  return { id, avatarUrl };
}

export function useSearchFriendsAreWatching(limit = 8) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

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
      const rows = (data ?? []) as HomeFeedRow[];

      // Only friends activity (exclude current user).
      const friendRows = rows.filter((r) => r.user_id !== userId && r.media_item_id);

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
        const mediaId = (r.media_item_id ?? "").toString();
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
          const poster = rowToDiscoverPoster(agg.row, null, "");
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
  const { session } = useAuth();
  const enabled = Boolean(session?.user?.id);

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
