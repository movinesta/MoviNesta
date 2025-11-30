import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

export interface PeopleSearchResult {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followersCount: number | null;
  followingCount: number | null;
  isFollowing: boolean;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface UserStatsRow {
  user_id: string;
  followers_count: number | null;
  following_count: number | null;
}

interface FollowRow {
  followed_id: string;
}

/**
 * useSearchPeople
 *
 * Looks up profiles by username/display name and annotates them with whether
 * the current user already follows them.
 */
export const useSearchPeople = (query: string) => {
  const trimmedQuery = query.trim();
  const { user } = useAuth();

  return useQuery<PeopleSearchResult[]>({
    queryKey: ["search", "people", { query: trimmedQuery, userId: user?.id ?? null }],
    enabled: trimmedQuery.length > 0,
    queryFn: async () => {
      // 1) Search profiles by username/display_name.
      const escaped = trimmedQuery.replace(/%/g, "\\%").replace(/_/g, "\\_");

      const profilesResult = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .returns<ProfileRow[]>()
        .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
        .limit(20);

      if (profilesResult.error) {
        throw new Error(profilesResult.error.message);
      }

      const profiles = profilesResult.data ?? [];

      const profileIds = profiles.map((row) => row.id as string);

      // 2) Load basic stats (followers/following counts) for these profiles.
      let statsByUserId = new Map<string, { followersCount: number; followingCount: number }>();

      if (profileIds.length) {
        const statsResult = await supabase
          .from("user_stats")
          .select("user_id, followers_count, following_count")
          .returns<UserStatsRow[]>()
          .in("user_id", profileIds);

        if (statsResult.error) {
          // Not fatal; log and continue without stats.
          console.warn("[useSearchPeople] Failed to load user_stats", statsResult.error.message);
        } else {
          statsByUserId = new Map(
            (statsResult.data ?? []).map((row) => [
              row.user_id,
              {
                followersCount: row.followers_count ?? 0,
                followingCount: row.following_count ?? 0,
              },
            ]),
          );
        }
      }

      // 3) If we don't have a logged-in user, we can't compute follow status.
      if (!user?.id) {
        return profiles.map((row) => {
          const stats = statsByUserId.get(row.id as string);
          return {
            id: row.id as string,
            username: row.username as string | null,
            displayName: row.display_name as string | null,
            avatarUrl: row.avatar_url as string | null,
            bio: row.bio as string | null,
            followersCount: stats?.followersCount ?? null,
            followingCount: stats?.followingCount ?? null,
            isFollowing: false,
          };
        });
      }

      // 3) Load who the current user already follows.
      const followsResult = await supabase
        .from("follows")
        .select("followed_id")
        .returns<FollowRow[]>()
        .eq("follower_id", user.id);

      if (followsResult.error) {
        // Not fatal for the search itself; log and continue.
        console.warn(
          "[useSearchPeople] Failed to load follows for current user",
          followsResult.error.message,
        );
      }

      const followedIds = new Set<string>((followsResult.data ?? []).map((row) => row.followed_id));

      return profiles.map((row) => {
        const stats = statsByUserId.get(row.id as string);
        return {
          id: row.id as string,
          username: row.username as string | null,
          displayName: row.display_name as string | null,
          avatarUrl: row.avatar_url as string | null,
          bio: row.bio as string | null,
          followersCount: stats?.followersCount ?? null,
          followingCount: stats?.followingCount ?? null,
          isFollowing: followedIds.has(row.id as string),
        };
      });
    },
  });
};
