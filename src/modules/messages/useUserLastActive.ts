import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Fetches a user's last activity timestamp from `profiles_public`.
 *
 * Prefers `last_seen_at` when available, falling back to `updated_at`.
 *
 * Note: This intentionally avoids relying on generated Supabase TS types, because
 * the column may be added via migrations and types are generated from a static schema file.
 */
export function useUserLastActive(userId: string | null) {
  return useQuery({
    queryKey: ["profiles_public:last_active", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!userId) return null;

      // Prefer last_seen_at if the DB has it.
      const first = await supabase
        .from("profiles_public")
        .select("id,last_seen_at,updated_at")
        .eq("id", userId)
        .maybeSingle();

      if (first.error) {
        const msg = (first.error.message ?? "").toLowerCase();

        // If the column doesn't exist yet, retry with updated_at only.
        if (msg.includes("last_seen_at") || msg.includes("does not exist") || msg.includes("column")) {
          const fallback = await supabase
            .from("profiles_public")
            .select("id,updated_at")
            .eq("id", userId)
            .maybeSingle();

          if (fallback.error) {
            throw new Error(fallback.error.message);
          }

          const row = fallback.data as any;
          return (row?.updated_at ?? null) as string | null;
        }

        throw new Error(first.error.message);
      }

      const row = first.data as any;
      return (row?.last_seen_at ?? row?.updated_at ?? null) as string | null;
    },
  });
}
