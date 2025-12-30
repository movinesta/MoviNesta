// src/modules/search/useToggleFollow.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import type { PeopleSearchResult } from "./useSearchPeople";
import type { SuggestedPerson } from "@/modules/profile/useSuggestedPeople";

interface ToggleFollowArgs {
  targetUserId: string;
  currentlyFollowing: boolean;
}

interface ToggleFollowResult {
  isFollowing: boolean;
}

const isErrorWithCode = (error: unknown): error is { code?: string } => {
  return typeof error === "object" && error !== null && "code" in error;
};

/**
 * useToggleFollow
 *
 * Small helper for follow/unfollow actions against public.follows.
 * It also patches any cached people search results so the UI stays in sync
 * and invalidates any profile queries.
 */
export const useToggleFollow = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<ToggleFollowResult, Error, ToggleFollowArgs>({
    mutationFn: async ({ targetUserId, currentlyFollowing }) => {
      if (!user) {
        throw new Error("You need to be signed in to follow people.");
      }

      if (user.id === targetUserId) {
        throw new Error("You can’t follow yourself.");
      }

      if (currentlyFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("followed_id", targetUserId);

        if (error) {
          throw error;
        }

        return { isFollowing: false };
      }

      const { error } = await supabase.from("follows").insert({
        follower_id: user.id,
        followed_id: targetUserId,
        created_at: new Date().toISOString(),
      });

      // Ignore "duplicate key" errors (race conditions).
      if (error && (!isErrorWithCode(error) || error.code !== "23505")) {
        throw error;
      }

      return { isFollowing: true };
    },
    onSuccess: (result, variables) => {
      const { targetUserId } = variables;
      const { isFollowing } = result;

      // Patch cached people search results.
      queryClient.setQueriesData<PeopleSearchResult[]>(
        { queryKey: ["search", "people"] },
        (existing) => {
          if (!existing) return existing;

          return existing.map((person) => {
            if (person.id !== targetUserId) return person;

            const nextFollowers = Math.max(
              0,
              (person.followersCount ?? 0) + (isFollowing ? 1 : -1),
            );

            return {
              ...person,
              isFollowing,
              followersCount: nextFollowers,
            };
          });
        },
      );

      
      // Patch cached suggested people results.
      queryClient.setQueriesData<SuggestedPerson[]>(
        { queryKey: ["suggested-people"] },
        (existing) => {
          if (!existing) return existing;
          return existing.map((person) => {
            if (person.id !== targetUserId) return person;
            const nextFollowers = Math.max(
              0,
              (person.followersCount ?? 0) + (isFollowing ? 1 : -1),
            );
            return { ...person, isFollowing, followersCount: nextFollowers };
          });
        },
      );
// Make any profile queries refetch so counts + state stay fresh.
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};
