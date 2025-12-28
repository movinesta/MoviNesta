import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/modules/auth/AuthProvider";
import {
  addDismissedSuggestedPerson,
  loadDismissedSuggestedPeople,
} from "./suggestedPeopleStorage";
import { resolveAvatarUrl } from "./resolveAvatarUrl";
import type { Database } from "@/types/supabase";

export interface SuggestedPerson {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  /** How many of the viewer's recent top-rated titles they have also rated. */
  commonTitlesCount?: number;
  /** A rough match percentage based on shared top-rated titles. */
  matchPercent?: number;
}

type UserStatsRow = Database["public"]["Tables"]["user_stats"]["Row"];
type ViewerRatingRow = Pick<Database["public"]["Tables"]["ratings"]["Row"], "title_id" | "rating">;
type CandidateRatingRow = Pick<Database["public"]["Tables"]["ratings"]["Row"], "user_id" | "title_id" | "rating">;

export const useSuggestedPeople = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<SuggestedPerson[]>({
    queryKey: ["suggested-people", user?.id ?? null],
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!user?.id) return [];

      const viewerId = user.id;
      const dismissed = new Set(loadDismissedSuggestedPeople(viewerId));

      // Who does the viewer already follow?
      const { data: followsData, error: followsError } = await supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", viewerId);

      if (followsError) {
        console.warn("[useSuggestedPeople] Failed to load follows", followsError.message);
      }

      const alreadyFollowing = new Set<string>((followsData ?? []).map((r) => r.followed_id));

      const excluded = new Set<string>([viewerId, ...dismissed, ...alreadyFollowing]);

      // Grab the viewer's top-rated titles so we can rank suggestions by taste similarity.
      const { data: viewerRatings, error: viewerRatingsError } = await supabase
        .from("ratings")
        .select("title_id, rating")
        .eq("user_id", viewerId)
        .order("rating", { ascending: false })
        .limit(40);

      if (viewerRatingsError) {
        console.warn(
          "[useSuggestedPeople] Failed to load viewer ratings",
          viewerRatingsError.message,
        );
      }

      const viewerTop = (viewerRatings as any as ViewerRatingRow[] | null)
        ? (viewerRatings as any as ViewerRatingRow[])
            .filter((row) => typeof row.title_id === "string" && typeof row.rating === "number")
            .slice(0, 30)
        : [];

      const viewerTopTitleIds = Array.from(new Set(viewerTop.map((row) => row.title_id)));
      const viewerRatingByTitleId = new Map(
        viewerTop.map((row) => [row.title_id, row.rating ?? 0]),
      );

      // Start with popular-ish accounts (user_stats is a light proxy).
      const { data: stats, error: statsError } = await supabase
        .from("user_stats")
        .select("user_id, followers_count, following_count")
        .order("followers_count", { ascending: false })
        .limit(60);

      if (statsError) {
        console.warn("[useSuggestedPeople] Failed to load user_stats", statsError.message);
      }

      const statsRows = ((stats as any as UserStatsRow[]) ?? []).filter(
        (row) => !excluded.has(row.user_id),
      );
      const candidateIds = statsRows.map((row) => row.user_id).slice(0, 40);

      if (!candidateIds.length) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles_public")
        .select("id, username, display_name, avatar_url, bio")
        .in("id", candidateIds)
        .limit(40);

      if (profilesError) {
        throw new Error(profilesError.message);
      }

      const statsByUserId = new Map(
        statsRows.map((row) => [
          row.user_id,
          { followersCount: row.followers_count ?? 0, followingCount: row.following_count ?? 0 },
        ]),
      );

      // Batch-fetch candidate ratings against the viewer's favorites, if we have enough signal.
      const overlapByUserId = new Map<
        string,
        { commonTitlesCount: number; matchPercent: number; score: number }
      >();

      if (viewerTopTitleIds.length >= 5) {
        const { data: candidateRatings, error: candidateRatingsError } = await supabase
          .from("ratings")
          .select("user_id, title_id, rating")
          .in("user_id", candidateIds)
          .in("title_id", viewerTopTitleIds)
          .limit(2000);

        if (candidateRatingsError) {
          console.warn(
            "[useSuggestedPeople] Failed to load candidate ratings",
            candidateRatingsError.message,
          );
        } else {
          const rows = (candidateRatings as any as CandidateRatingRow[]) ?? [];
          const byUser = new Map<string, CandidateRatingRow[]>();
          rows.forEach((row) => {
            if (!row?.user_id) return;
            const arr = byUser.get(row.user_id) ?? [];
            arr.push(row);
            byUser.set(row.user_id, arr);
          });

          candidateIds.forEach((id) => {
            const list = byUser.get(id) ?? [];
            const overlaps = list.filter((r) => viewerRatingByTitleId.has(r.title_id));
            const commonTitlesCount = overlaps.length;

            if (!commonTitlesCount) {
              overlapByUserId.set(id, { commonTitlesCount: 0, matchPercent: 0, score: 0 });
              return;
            }

            let diffSum = 0;
            let diffCount = 0;
            overlaps.forEach((r) => {
              const viewerRating = viewerRatingByTitleId.get(r.title_id);
              if (typeof viewerRating !== "number" || typeof r.rating !== "number") return;
              diffSum += Math.abs(viewerRating - r.rating);
              diffCount += 1;
            });

            const avgAbsDiff = diffCount ? diffSum / diffCount : 0;

            // Score: more overlap is better, closer ratings is slightly better.
            const score = commonTitlesCount * 10 - avgAbsDiff * 2;
            const matchPercent = Math.round(
              (commonTitlesCount / Math.max(1, viewerTopTitleIds.length)) * 100,
            );
            overlapByUserId.set(id, { commonTitlesCount, matchPercent, score });
          });
        }
      }

      const rawPeople = (profiles ?? [])
        .map((row: any) => {
          const stats = statsByUserId.get(row.id);
          const overlap = overlapByUserId.get(row.id);
          return {
            id: row.id,
            username: row.username ?? null,
            displayName: row.display_name ?? null,
            avatarPathOrUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
            bio: row.bio ?? null,
            followersCount: stats?.followersCount ?? 0,
            followingCount: stats?.followingCount ?? 0,
            isFollowing: alreadyFollowing.has(row.id),
            commonTitlesCount: overlap?.commonTitlesCount,
            matchPercent: overlap?.matchPercent,
            _score: overlap?.score ?? 0,
          };
        })
        .filter((person) => !excluded.has(person.id));

      // Resolve avatars consistently (support bucket paths).
      const withAvatars: SuggestedPerson[] = await Promise.all(
        rawPeople.map(async (person) => {
          const avatarUrl = await resolveAvatarUrl(person.avatarPathOrUrl);
          return {
            id: person.id,
            username: person.username,
            displayName: person.displayName,
            avatarUrl,
            bio: person.bio,
            followersCount: person.followersCount,
            followingCount: person.followingCount,
            isFollowing: person.isFollowing,
            commonTitlesCount: person.commonTitlesCount,
            matchPercent: person.matchPercent,
          };
        }),
      );

      // Primary ordering: taste score, then overlap count, then followers, then name.
      return withAvatars
        .map((p) => ({
          person: p,
          score: overlapByUserId.get(p.id)?.score ?? 0,
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const commonA = a.person.commonTitlesCount ?? 0;
          const commonB = b.person.commonTitlesCount ?? 0;
          if (commonB !== commonA) return commonB - commonA;
          if (b.person.followersCount !== a.person.followersCount) {
            return b.person.followersCount - a.person.followersCount;
          }
          const nameA = (a.person.displayName ?? a.person.username ?? "").toLowerCase();
          const nameB = (b.person.displayName ?? b.person.username ?? "").toLowerCase();
          return nameA.localeCompare(nameB);
        })
        .map((p) => p.person)
        .slice(0, 15);
    },
  });

  const dismissPerson = (profileId: string) => {
    if (!user?.id) return;
    addDismissedSuggestedPerson(user.id, profileId);
    queryClient.invalidateQueries({ queryKey: ["suggested-people", user.id] });
  };

  return { ...query, dismissPerson };
};
