import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/modules/auth/AuthProvider";
import { resolveAvatarUrl } from "./resolveAvatarUrl";

export type ConnectionMode = "followers" | "following";

export interface ConnectionPerson {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isFollowing: boolean;
}

const PAGE_SIZE = 25;

type FollowRow = {
  follower_id: string;
  followed_id: string;
  created_at: string | null;
};

const normalizeHandle = (username: string | null) => {
  if (!username) return null;
  const trimmed = username.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
};

export function useProfileConnections(profileId: string | null | undefined, mode: ConnectionMode) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  return useInfiniteQuery<{ items: ConnectionPerson[]; nextOffset?: number }, Error>({
    queryKey: ["connections", profileId ?? null, mode, viewerId],
    enabled: Boolean(profileId),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    queryFn: async ({ pageParam }) => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      if (!profileId) return { items: [] };

      const selectCols = "follower_id, followed_id, created_at";
      const followQuery = supabase.from("follows").select(selectCols).order("created_at", {
        ascending: false,
      });

      const { data: follows, error: followsError } = await (mode === "followers"
        ? followQuery.eq("followed_id", profileId)
        : followQuery.eq("follower_id", profileId)
      ).range(offset, offset + PAGE_SIZE - 1);

      if (followsError) {
        throw new Error(followsError.message);
      }

      const followRows = (follows ?? []) as unknown as FollowRow[];
      const ids = followRows.map((row) => (mode === "followers" ? row.follower_id : row.followed_id));

      if (ids.length === 0) {
        return { items: [] };
      }

      const { data: profiles, error: profilesError } = await (supabase as any)
        .from("profiles_public")
        .select("id, username, display_name, avatar_url, bio")
        .in("id", ids);

      if (profilesError) {
        throw new Error(profilesError.message);
      }

      const rows: any[] = profiles ?? [];
      const byId = new Map<string, any>(rows.map((row) => [row.id, row]));

      const avatarUrls = await Promise.all(
        ids.map((id) => resolveAvatarUrl(typeof byId.get(id)?.avatar_url === "string" ? byId.get(id).avatar_url : null)),
      );

      let viewerFollowing = new Set<string>();
      if (viewerId) {
        const { data: viewerFollows, error: viewerFollowsError } = await supabase
          .from("follows")
          .select("followed_id")
          .eq("follower_id", viewerId)
          .in("followed_id", ids);

        if (!viewerFollowsError) {
          viewerFollowing = new Set((viewerFollows ?? []).map((r) => r.followed_id));
        }
      }

      const items: ConnectionPerson[] = ids.map((id, idx) => {
        const row = byId.get(id);
        return {
          id,
          username: row?.username ?? null,
          displayName: row?.display_name ?? null,
          avatarUrl: avatarUrls[idx] ?? null,
          bio: row?.bio ?? null,
          isFollowing: viewerFollowing.has(id),
        };
      });

      const nextOffset = followRows.length === PAGE_SIZE ? offset + PAGE_SIZE : undefined;

      return { items, nextOffset };
    },
  });
}

export const formatHandle = normalizeHandle;
