// src/modules/profile/useProfile.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

export interface ProfileSummary {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isCurrentUser: boolean;
}

const sanitizeUsername = (username: string | null | undefined): string | null => {
  if (!username) return null;
  const trimmed = username.trim();
  if (!trimmed) return null;
  // Accept both "@username" and "username".
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
};

/**
 * Fetch a single profile by username, enriched with basic stats and
 * follow status for the current viewer.
 */
export const useProfileByUsername = (username: string | null | undefined) => {
  const { user } = useAuth();
  const normalizedUsername = sanitizeUsername(username);

  return useQuery<ProfileSummary | null, Error>({
    queryKey: ["profile", "byUsername", normalizedUsername, user?.id ?? null],
    enabled: !!normalizedUsername,
    queryFn: async () => {
      if (!normalizedUsername) {
        return null;
      }

      // 1) Look up the profile row by username.
      const {
        data: profileRow,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (profileError) {
        // "No rows" -> nicer error.
        if ((profileError as any).code === "PGRST116") {
          throw new Error("Profile not found");
        }
        throw profileError;
      }

      if (!profileRow) {
        throw new Error("Profile not found");
      }

      const profileId = profileRow.id as string;

      // 2) Grab aggregate stats for this user (followers / following).
      const {
        data: statsRow,
        error: statsError,
      } = await supabase
        .from("user_stats")
        .select("followers_count, following_count")
        .eq("user_id", profileId)
        .maybeSingle();

      if (statsError) {
        throw statsError;
      }

      const followersCount = (statsRow?.followers_count as number | null) ?? 0;
      const followingCount = (statsRow?.following_count as number | null) ?? 0;

      // 3) If we have a logged-in viewer, check follow status.
      let isFollowing = false;

      if (user && user.id !== profileId) {
        const {
          data: followRow,
          error: followError,
        } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("followed_id", profileId)
          .maybeSingle();

        if (followError && (followError as any).code !== "PGRST116") {
          throw followError;
        }

        isFollowing = !!followRow;
      }

      return {
        id: profileId,
        username: profileRow.username as string | null,
        displayName: profileRow.display_name as string | null,
        avatarUrl: profileRow.avatar_url as string | null,
        bio: profileRow.bio as string | null,
        followersCount,
        followingCount,
        isFollowing,
        isCurrentUser: !!user && user.id === profileId,
      };
    },
  });
};

/**
 * Convenience wrapper for fetching the *current* user's profile +
 * basic stats (for Settings, avatar menus, etc).
 */
export const useCurrentProfile = () => {
  const { user } = useAuth();

  return useQuery<ProfileSummary | null, Error>({
    queryKey: ["profile", "current", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;

      // 1) Fetch the profile row by auth user id.
      const {
        data: profileRow,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        if ((profileError as any).code === "PGRST116") {
          throw new Error("Profile not found for current user");
        }
        throw profileError;
      }

      if (!profileRow) {
        throw new Error("Profile not found for current user");
      }

      const profileId = profileRow.id as string;

      // 2) Pull stats for the current user.
      const {
        data: statsRow,
        error: statsError,
      } = await supabase
        .from("user_stats")
        .select("followers_count, following_count")
        .eq("user_id", profileId)
        .maybeSingle();

      if (statsError) {
        throw statsError;
      }

      const followersCount = (statsRow?.followers_count as number | null) ?? 0;
      const followingCount = (statsRow?.following_count as number | null) ?? 0;

      return {
        id: profileId,
        username: profileRow.username as string | null,
        displayName: profileRow.display_name as string | null,
        avatarUrl: profileRow.avatar_url as string | null,
        bio: profileRow.bio as string | null,
        followersCount,
        followingCount,
        isFollowing: false,
        isCurrentUser: true,
      };
    },
  });
};
