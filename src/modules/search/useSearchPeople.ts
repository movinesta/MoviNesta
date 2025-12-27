import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { Database } from "@/types/supabase";

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
};

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

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
// Table missing from generated types
type UserStatsRow = {
  user_id: string;
  followers_count: number | null;
  following_count: number | null;
};
type FollowRow = Database["public"]["Tables"]["follows"]["Row"];

/**
 * useSearchPeople
 *
 * Looks up profiles by username/display name and annotates them with whether
 * the current user already follows them.
 *
 * NOTE: We DO NOT exclude the current user from results. The UI will hide
 * follow/message actions for self.
 */
export const useSearchPeople = (query: string) => {
  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.replace(/^@+/, "");
  const loweredQuery = normalizedQuery.toLowerCase();
  const { user } = useAuth();

  return useQuery<PeopleSearchResult[]>({
    queryKey: ["search", "people", { query: normalizedQuery, userId: user?.id ?? null }],
    enabled: normalizedQuery.length > 0,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
    queryFn: async ({ signal }) => {
      throwIfAborted(signal);

      // 1) Search profiles by username/display_name.
      const escaped = normalizedQuery.replace(/%/g, "\\%").replace(/_/g, "\\_");

      let builder = (supabase as any)
        .from("profiles_public")
        .select("id, username, display_name, avatar_url, bio")
        .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
        .limit(20);

      if (signal) {
        builder = builder.abortSignal(signal);
      }

      const profilesResult = await builder;

      throwIfAborted(signal);

      if (profilesResult.error) {
        throw new Error(profilesResult.error.message);
      }

      const profiles = (profilesResult.data as ProfileRow[]) ?? [];
      const profileIds = profiles.map((row) => row.id);

      // 2) Load basic stats (followers/following counts) for these profiles.
      let statsByUserId = new Map<string, { followersCount: number; followingCount: number }>();

      if (profileIds.length) {
        let statsBuilder = supabase
          .from("user_stats" as any)
          .select("user_id, followers_count, following_count")
          .in("user_id", profileIds);

        if (signal) {
          statsBuilder = statsBuilder.abortSignal(signal);
        }

        const statsResult = await statsBuilder;

        throwIfAborted(signal);

        if (statsResult.error) {
          // Not fatal; log and continue without stats.
          console.warn("[useSearchPeople] Failed to load user_stats", statsResult.error.message);
        } else {
          statsByUserId = new Map(
            ((statsResult.data as any as UserStatsRow[]) ?? []).map((row) => [
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
          const stats = statsByUserId.get(row.id);
          return {
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            bio: row.bio,
            followersCount: stats?.followersCount ?? null,
            followingCount: stats?.followingCount ?? null,
            isFollowing: false,
          };
        });
      }

      // 4) Load who the current user already follows.
      let followsBuilder = supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", user.id);

      if (signal) {
        followsBuilder = followsBuilder.abortSignal(signal);
      }

      const followsResult = await followsBuilder;

      throwIfAborted(signal);

      if (followsResult.error) {
        // Not fatal for the search itself; log and continue.
        console.warn(
          "[useSearchPeople] Failed to load follows for current user",
          followsResult.error.message,
        );
      }

      const followedIds = new Set<string>(
        ((followsResult.data as FollowRow[]) ?? []).map((row) => row.followed_id),
      );

      const scored = profiles.map((row) => {
        const stats = statsByUserId.get(row.id);
        const username = row.username ?? "";
        const displayName = row.display_name ?? "";

        // Lightweight relevance boost so exact/prefix matches show up first.
        const normalizedUsername = username.toLowerCase();
        const normalizedDisplay = displayName.toLowerCase();

        let relevance = 0;
        if (normalizedUsername === loweredQuery) {
          relevance += 100;
        } else if (normalizedUsername.startsWith(loweredQuery)) {
          relevance += 80;
        } else if (normalizedDisplay.startsWith(loweredQuery)) {
          relevance += 60;
        } else if (normalizedUsername.includes(loweredQuery)) {
          relevance += 40;
        } else if (normalizedDisplay.includes(loweredQuery)) {
          relevance += 30;
        }

        // Popular accounts should float slightly higher when relevance ties.
        const followerBoost = Math.min(15, Math.floor((stats?.followersCount ?? 0) / 500));

        return {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          bio: row.bio,
          followersCount: stats?.followersCount ?? null,
          followingCount: stats?.followingCount ?? null,
          isFollowing: followedIds.has(row.id),
          relevance: relevance + followerBoost,
        };
      });

      return scored
        .sort((a, b) => {
          if (b.relevance !== a.relevance) return b.relevance - a.relevance;
          const nameA = (a.displayName ?? a.username ?? "").toLowerCase();
          const nameB = (b.displayName ?? b.username ?? "").toLowerCase();
          return nameA.localeCompare(nameB);
        })
        .map(({ relevance: _ignored, ...rest }) => rest);
    },
  });
};
