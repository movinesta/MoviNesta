import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/modules/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { resolveAvatarUrl } from "@/modules/profile/resolveAvatarUrl";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";

export interface HomeStory {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  listId: string | null;
  listName: string | null;
  coverPosterUrl: string | null;
}

type FollowRow = { followed_id: string | null };
type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type ListRow = {
  id: string;
  user_id: string;
  name: string;
  is_public: boolean;
  updated_at: string | null;
  created_at: string;
};

type ListItemRow = {
  list_id: string;
  title_id: string;
  position: number | null;
  created_at: string;
};

const pickPrimaryListForUser = (lists: ListRow[]) => {
  if (!lists.length) return null;
  // Prefer a "Top movies" style list if it exists.
  const top = lists.find((l) => /top\s+movies/i.test(l.name));
  return top ?? lists[0];
};

/**
 * "Stories" for the Home feed: each followed user contributes their most-recent highlight list.
 * We keep this lightweight (avatars + 1 cover poster per list).
 */
export const useHomeStories = () => {
  const { user } = useAuth();

  return useQuery<HomeStory[]>({
    queryKey: ["home", "stories", user?.id ?? null],
    enabled: Boolean(user?.id),
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (!user?.id) return [];

      // 1) Who do I follow? (limit to keep the query cheap)
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", user.id)
        .limit(40);

      if (followsError) throw new Error(followsError.message);

      const followedIds = ((follows as FollowRow[]) ?? [])
        .map((r) => r.followed_id)
        .filter((v): v is string => Boolean(v));

      const userIds = Array.from(new Set([user.id, ...followedIds])).slice(0, 41);

      // 2) Grab public profile info for those users.
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from("profiles_public")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      if (profilesError) throw new Error(profilesError.message);

      const profileRows = (profiles as ProfileRow[]) ?? [];
      const profileById = new Map(profileRows.map((p) => [p.id, p]));

      // Resolve avatar URLs (storage paths -> signed URLs).
      const avatarPairs = await Promise.all(
        userIds.map(async (id) => {
          const row = profileById.get(id);
          const avatarUrl = await resolveAvatarUrl(row?.avatar_url ?? null);
          return [id, avatarUrl] as const;
        }),
      );
      const avatarById = new Map(avatarPairs);

      // 3) Fetch highlights (lists) for those users.
      const { data: lists, error: listsError } = await (supabase as any)
        .from("lists")
        .select("id, user_id, name, is_public, updated_at, created_at")
        .in("user_id", userIds)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(240);

      if (listsError) throw new Error(listsError.message);

      const listRows = (lists as ListRow[]) ?? [];

      // Group by user and pick the primary list per user.
      const listsByUser = new Map<string, ListRow[]>();
      for (const l of listRows) {
        const arr = listsByUser.get(l.user_id) ?? [];
        arr.push(l);
        listsByUser.set(l.user_id, arr);
      }

      const primaryListByUserId = new Map<string, ListRow>();
      for (const id of userIds) {
        const all = listsByUser.get(id) ?? [];
        const visible = id === user.id ? all : all.filter((l) => l.is_public);
        const picked = pickPrimaryListForUser(visible);
        if (picked) primaryListByUserId.set(id, picked);
      }

      const primaryListIds = Array.from(
        new Set(Array.from(primaryListByUserId.values()).map((l) => l.id)),
      );

      // 4) Pick a cover title for each list.
      const coverTitleByListId = new Map<string, string>();
      if (primaryListIds.length) {
        const { data: items, error: itemsError } = await (supabase as any)
          .from("list_items")
          .select("list_id, title_id, position, created_at")
          .in("list_id", primaryListIds)
          .order("position", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: true })
          .limit(400);

        if (itemsError) {
          console.warn("[useHomeStories] Failed to load list_items", itemsError.message);
        }

        for (const row of (items as ListItemRow[]) ?? []) {
          if (!row?.list_id || !row?.title_id) continue;
          if (!coverTitleByListId.has(row.list_id)) {
            coverTitleByListId.set(row.list_id, row.title_id);
          }
        }
      }

      // 5) Resolve posters.
      const coverTitleIds = Array.from(new Set(Array.from(coverTitleByListId.values())));
      const posterByTitleId = new Map<string, string | null>();

      if (coverTitleIds.length) {
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
          .in("id", coverTitleIds);

        if (titlesError) {
          console.warn("[useHomeStories] Failed to load media_items", titlesError.message);
        } else {
          for (const row of (titles as MediaItemRow[]) ?? []) {
            const summary = mapMediaItemToSummary(row);
            posterByTitleId.set(row.id, summary.posterUrl ?? summary.backdropUrl ?? null);
          }
        }
      }

      // 6) Build stories (keep current user first).
      const orderedIds = [user.id, ...userIds.filter((id) => id !== user.id)];

      return orderedIds
        .map((id) => {
          const p = profileById.get(id);
          const list = primaryListByUserId.get(id);
          const coverTitleId = list ? (coverTitleByListId.get(list.id) ?? null) : null;
          return {
            userId: id,
            username: p?.username ?? null,
            displayName: p?.display_name ?? null,
            avatarUrl: avatarById.get(id) ?? null,
            listId: list?.id ?? null,
            listName: list?.name ?? null,
            coverPosterUrl: coverTitleId ? (posterByTitleId.get(coverTitleId) ?? null) : null,
          } satisfies HomeStory;
        })
        .filter((s) => Boolean(s.username || s.displayName));
    },
  });
};
