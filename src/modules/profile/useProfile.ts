// src/modules/profile/useProfile.ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { resolveAvatarUrl } from "./resolveAvatarUrl";
import type { Database } from "@/types/supabase";
import { ProfilePublicRow } from "@/types/schema-overrides";

// Avatar URL resolution is centralized in resolveAvatarUrl.ts so the entire app
// respects the same storage/path rules.

export interface ProfileSummary {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  verifiedType: ProfilePublicRow["verified_type"] | null;
  verifiedLabel: string | null;
  verifiedAt: string | null;
  verifiedByOrg: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isCurrentUser: boolean;
}

type UserStatsRow = Database["public"]["Tables"]["user_stats"]["Row"];
type ProfilePublicLookupRow = Pick<
  ProfilePublicRow,
  | "id"
  | "username"
  | "display_name"
  | "avatar_url"
  | "bio"
  | "is_verified"
  | "verified_type"
  | "verified_label"
  | "verified_at"
  | "verified_by_org"
>;
type ProfilePublicVerificationRow = Pick<
  ProfilePublicRow,
  "is_verified" | "verified_type" | "verified_label" | "verified_at" | "verified_by_org"
>;

const isNotFoundError = (error: PostgrestError | null) => error?.code === "PGRST116";

const isUuid = (value: string) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value,
  );

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

  const lookupMode = normalizedUsername && isUuid(normalizedUsername) ? "id" : "username";

  return useQuery<ProfileSummary | null, Error>({
    queryKey: ["profile", "byUsername", lookupMode, normalizedUsername, user?.id ?? null],
    enabled: !!normalizedUsername,
    queryFn: async () => {
      if (!normalizedUsername) {
        return null;
      }

      // 1) Look up the profile row by username.
      const { data, error: profileError } = await supabase
        .from("profiles_public")
        .select(
          "id, username, display_name, avatar_url, bio, is_verified, verified_type, verified_label, verified_at, verified_by_org",
        )
        .eq(lookupMode, normalizedUsername)
        .maybeSingle();

      if (profileError) {
        // "No rows" -> nicer error.
        if (isNotFoundError(profileError)) {
          throw new Error("Profile not found");
        }
        throw profileError;
      }

      const profileRow = data as ProfilePublicLookupRow | null;

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
        isVerified: !!profileRow.is_verified,
        verifiedType: profileRow.verified_type ?? null,
        verifiedLabel: profileRow.verified_label ?? null,
        verifiedAt: profileRow.verified_at ?? null,
        verifiedByOrg: profileRow.verified_by_org ?? null,
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
export const useCurrentProfile = (): UseQueryResult<ProfileSummary | null, Error> => {
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

      // Pull verification mirror fields from profiles_public (safe, display-ready).
      const { data: publicData, error: publicError } = await supabase
        .from("profiles_public")
        .select("is_verified, verified_type, verified_label, verified_at, verified_by_org")
        .eq("id", profileId)
        .maybeSingle();

      if (publicError && !isNotFoundError(publicError)) {
        throw publicError;
      }
      const publicRow = publicData as ProfilePublicVerificationRow | null;

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
        isVerified: !!publicRow?.is_verified,
        verifiedType: publicRow?.verified_type ?? null,
        verifiedLabel: publicRow?.verified_label ?? null,
        verifiedAt: publicRow?.verified_at ?? null,
        verifiedByOrg: publicRow?.verified_by_org ?? null,
        followersCount,
        followingCount,
        isFollowing: false,
        isCurrentUser: true,
      };
    },
  });
};
