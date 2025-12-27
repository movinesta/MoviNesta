import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/modules/auth/AuthProvider";
import { resolveAvatarUrl } from "@/modules/profile/resolveAvatarUrl";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";

export type ActivityActor = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type ActivityNotificationKind = "follow" | "comment" | "reply";

export type ActivityNotification = {
  id: string;
  kind: ActivityNotificationKind;
  createdAt: string;
  actor: ActivityActor;
  text: string;
  /** Optional right-side thumbnail (e.g., title poster). */
  thumbnailUrl?: string | null;
  /** If present, lets the UI deep-link into the app (title detail, profile, etc.). */
  linkTo?: string;
  /** If true, show "Follow back" affordance. */
  canFollowBack?: boolean;
  isFollowingBack?: boolean;
};

type FollowRow = { follower_id: string; created_at: string };

type CommentJoinRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  review_id: string | null;
  reviews?: { user_id: string; title_id: string } | null;
};

type PublicProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const normalizeHandle = (username: string | null) => {
  if (!username) return null;
  const trimmed = username.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
};

const snippet = (value: string, max = 80) => {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
};

async function loadProfiles(ids: string[]): Promise<Map<string, ActivityActor>> {
  if (!ids.length) return new Map();

  const { data, error } = await (supabase as any)
    .from("profiles_public")
    .select("id, username, display_name, avatar_url")
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as PublicProfileRow[]) ?? [];
  const byId = new Map(rows.map((r) => [r.id, r] as const));

  const avatarPairs = await Promise.all(
    ids.map(async (id) => {
      const row = byId.get(id);
      const avatarUrl = await resolveAvatarUrl(row?.avatar_url ?? null);
      return [id, avatarUrl] as const;
    }),
  );
  const avatarById = new Map(avatarPairs);

  const actors = new Map<string, ActivityActor>();
  ids.forEach((id) => {
    const row = byId.get(id);
    actors.set(id, {
      id,
      username: row?.username ?? null,
      displayName: row?.display_name ?? null,
      avatarUrl: avatarById.get(id) ?? null,
    });
  });

  return actors;
}

async function loadTitlePosters(titleIds: string[]): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(titleIds)).filter(Boolean);
  if (!unique.length) return new Map();

  const { data, error } = await supabase
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
    .in("id", unique);

  if (error) {
    console.warn("[useActivityNotifications] Failed to load media_items", error.message);
    return new Map();
  }

  const posterById = new Map<string, string | null>();
  (data as MediaItemRow[] | null)?.forEach((row) => {
    const summary = mapMediaItemToSummary(row);
    posterById.set(row.id, summary.posterUrl ?? summary.backdropUrl ?? null);
  });
  return posterById;
}

export function useActivityNotifications() {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  return useQuery<{
    notifications: ActivityNotification[];
    peopleYouDontFollowBack: ActivityActor[];
  }>({
    queryKey: ["activity", "notifications", viewerId],
    enabled: Boolean(viewerId),
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (!viewerId) {
        return { notifications: [], peopleYouDontFollowBack: [] };
      }

      // --- Incoming follows ("X started following you")
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("follower_id, created_at")
        .eq("followed_id", viewerId)
        .order("created_at", { ascending: false })
        .limit(80);

      if (followsError) throw new Error(followsError.message);

      const followRows = (follows as unknown as FollowRow[]) ?? [];
      const followerIds = Array.from(
        new Set(followRows.map((r) => r.follower_id).filter(Boolean)),
      );

      // Who am I following (so we can show "Follow back")
      let viewerFollowing = new Set<string>();
      if (followerIds.length) {
        const { data: viewerFollows, error: viewerFollowsError } = await supabase
          .from("follows")
          .select("followed_id")
          .eq("follower_id", viewerId)
          .in("followed_id", followerIds);

        if (!viewerFollowsError) {
          viewerFollowing = new Set((viewerFollows ?? []).map((r) => r.followed_id));
        }
      }

      // --- Comments on my reviews
      // NOTE: We use an inner join to only return comments whose review belongs to the viewer.
      const { data: commentRowsRaw, error: commentsError } = await (supabase as any)
        .from("comments")
        .select("id, user_id, body, created_at, review_id, reviews!inner(user_id, title_id)")
        .eq("reviews.user_id", viewerId)
        .order("created_at", { ascending: false })
        .limit(80);

      if (commentsError) {
        // Don't fail the whole page if this join isn't available in a local schema.
        console.warn("[useActivityNotifications] Failed to load comments", commentsError.message);
      }

      const commentRows = (commentRowsRaw as CommentJoinRow[] | null) ?? [];
      const commenterIds = Array.from(
        new Set(commentRows.map((r) => r.user_id).filter(Boolean)),
      );

      const actorIds = Array.from(new Set([...followerIds, ...commenterIds]));
      const actorsById = await loadProfiles(actorIds);

      const commentTitleIds = commentRows
        .map((r) => r.reviews?.title_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0);
      const postersByTitleId = await loadTitlePosters(commentTitleIds);

      const followNotifications: ActivityNotification[] = followRows
        .map((row) => {
          const actor = actorsById.get(row.follower_id);
          if (!actor) return null;
          const handle = normalizeHandle(actor.username);
          const name = actor.displayName || handle || "Someone";
          const isFollowingBack = viewerFollowing.has(actor.id);
          return {
            id: `follow:${row.follower_id}:${row.created_at}`,
            kind: "follow",
            createdAt: row.created_at,
            actor,
            text: `${name} started following you.`,
            linkTo: actor.username ? `/u/${actor.username}` : undefined,
            canFollowBack: true,
            isFollowingBack,
          } satisfies ActivityNotification;
        })
        .filter((v): v is ActivityNotification => Boolean(v));

      const commentNotifications: ActivityNotification[] = commentRows
        .map((row) => {
          const actor = actorsById.get(row.user_id);
          if (!actor) return null;
          const handle = normalizeHandle(actor.username);
          const name = actor.displayName || handle || "Someone";
          const titleId = row.reviews?.title_id ?? null;
          const poster = titleId ? postersByTitleId.get(titleId) ?? null : null;
          return {
            id: `comment:${row.id}`,
            kind: row.review_id ? "comment" : "reply",
            createdAt: row.created_at,
            actor,
            text: `${name} commented: “${snippet(row.body)}”`,
            thumbnailUrl: poster,
            linkTo: titleId ? `/title/${titleId}` : undefined,
          } satisfies ActivityNotification;
        })
        .filter((v): v is ActivityNotification => Boolean(v));

      const notifications = [...followNotifications, ...commentNotifications].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1,
      );

      const peopleYouDontFollowBack = followerIds
        .filter((id) => !viewerFollowing.has(id))
        .map((id) => actorsById.get(id))
        .filter((v): v is ActivityActor => Boolean(v));

      return { notifications, peopleYouDontFollowBack };
    },
  });
}
