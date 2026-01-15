import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * "Posts" on the profile header.
 * We treat posts as diary-relevant activity events.
 */
export const useProfilePostCount = (userId: string | null | undefined) => {
  return useQuery<number>({
    queryKey: ["profile", "post-count", userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!userId) return 0;

      const { count, error } = await supabase
        .from("activity_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("event_type", [
          "rating_created",
          "review_created",
          "watchlist_added",
          "watchlist_removed",
          "list_created",
          "list_item_added",
        ]);

      if (error) {
        console.warn("[useProfilePostCount] Failed to count posts", error.message);
        return 0;
      }

      return count ?? 0;
    },
  });
};
