// src/modules/profile/useProfile.ts
import { useQuery } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const isAllowedSupabaseAvatarUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith(".supabase.co") ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
};

async function resolveAvatarUrl(avatarPathOrUrl: string | null): Promise<string | null> {
  if (!avatarPathOrUrl) return null;
  if (isHttpUrl(avatarPathOrUrl)) {
    return isAllowedSupabaseAvatarUrl(avatarPathOrUrl) ? avatarPathOrUrl : null;
  }

  // avatar_url stores the storage object path in bucket "avatars".
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(avatarPathOrUrl, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

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

type UserStatsRow = {
  user_id: string;
  followers_count: number | null;
  following_count: number | null;
};

const isNotFoundError = (error: PostgrestError | null) => error?.code === "PGRST116";

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
      const { data: profileRow, error: profileError } = await (supabase as any)
        .from("profiles_public")
        .select("id, username, display_name, avatar_url, bio")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (profileError) {
        // "No rows" -> nicer error.
        if (isNotFoundError(profileError)) {
          throw new Error("Profile not found");
        }
        throw profileError;
      }

      if (!profileRow) {
        throw new Error("Profile not found");
      }

      const profileId = profileRow.id;

      const avatarUrl = await resolveAvatarUrl(profileRow.avatar_url);

      // 2) Grab aggregate stats for this user (followers / following).
      const [
        { count: followersCount, error: followersError },
        { count: followingCount, error: followingError },
      ] = await Promise.all([
        supabase
          .from("follows")
          .select("followed_id", { count: "exact", head: true })
          .eq("followed_id", profileId),
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("follower_id", profileId),
      ]);

      if (followersError) {
        throw followersError;
      }

      if (followingError) {
        throw followingError;
      }

      // 3) If we have a logged-in viewer, check follow status.
      let isFollowing = false;

      if (user && user.id !== profileId) {
        const { data: followRow, error: followError } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("followed_id", profileId)
          .maybeSingle();

        if (followError && !isNotFoundError(followError)) {
          throw followError;
        }

        isFollowing = !!followRow;
      }

      return {
        id: profileId,
        username: profileRow.username,
        displayName: profileRow.display_name,
        avatarUrl,
        bio: profileRow.bio,
        followersCount: followersCount ?? 0,
        followingCount: followingCount ?? 0,
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
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        if (isNotFoundError(profileError)) {
          throw new Error("Profile not found for current user");
        }
        throw profileError;
      }

      if (!profileRow) {
        throw new Error("Profile not found for current user");
      }

      const profileId = profileRow.id;

      const avatarUrl = await resolveAvatarUrl(profileRow.avatar_url);

      // 2) Pull stats for the current user.
      const { data: statsRow, error: statsError } = await supabase
        .from("user_stats")
        .select("followers_count, following_count")
        .eq("user_id", profileId)
        .maybeSingle();

      if (statsError) {
        throw statsError;
      }

      const followersCount = (statsRow as UserStatsRow | null)?.followers_count ?? 0;
      const followingCount = (statsRow as UserStatsRow | null)?.following_count ?? 0;

      return {
        id: profileId,
        username: profileRow.username,
        displayName: profileRow.display_name,
        avatarUrl,
        bio: profileRow.bio,
        followersCount,
        followingCount,
        isFollowing: false,
        isCurrentUser: true,
      };
    },
  });
};
