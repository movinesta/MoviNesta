import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import type { Database } from "@/types/supabase";

export interface BlockStatus {
  youBlocked: boolean;
  blockedYou: boolean;
}

type BlockedUsersRow = Database["public"]["Tables"]["blocked_users"]["Row"];

export type BlockCheckRow = Pick<BlockedUsersRow, "blocker_id" | "blocked_id">;

export async function fetchBlockStatus(
  client: typeof supabase,
  userId: string,
  otherUserId: string,
): Promise<BlockStatus> {
  const { data, error } = await client
    .from("blocked_users")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`,
    );

  if (error) {
    throw error;
  }

  const rows: BlockCheckRow[] = data ?? [];
  const youBlocked = rows.some(
    (row) => row.blocker_id === userId && row.blocked_id === otherUserId,
  );
  const blockedYou = rows.some(
    (row) => row.blocker_id === otherUserId && row.blocked_id === userId,
  );

  return { youBlocked, blockedYou } satisfies BlockStatus;
}

/**
 * React Query hook for checking and toggling block status between the
 * current user and another user.
 *
 * - youBlocked: current user has blocked the other user
 * - blockedYou: the other user has blocked the current user
 *
 * Backed by the `blocked_users` table in Supabase:
 *   blocked_users (
 *     blocker_id uuid,
 *     blocked_id uuid,
 *     created_at timestamptz
 *   )
 */
export const useBlockStatus = (otherUserId: string | null) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const queryKey = ["block-status", userId, otherUserId] as const;

  const query = useQuery<BlockStatus>({
    queryKey,
    enabled: Boolean(userId && otherUserId && userId !== otherUserId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId || !otherUserId || userId === otherUserId) {
        return { youBlocked: false, blockedYou: false };
      }

      try {
        return await fetchBlockStatus(supabase, userId, otherUserId);
      } catch (error) {
        console.error("[useBlockStatus] Failed to load block status", error);
        const err = error as { message?: string };
        throw new Error(err.message ?? "Failed to load block status");
      }
    },
  });

  const block = useMutation({
    mutationFn: async () => {
      if (!userId || !otherUserId) {
        throw new Error("Missing user ids for block operation.");
      }

      const { error } = await supabase.from("blocked_users").upsert(
        {
          blocker_id: userId,
          blocked_id: otherUserId,
          created_at: new Date().toISOString(),
        },
        { onConflict: "blocker_id,blocked_id" },
      );

      if (error) {
        console.error("[useBlockStatus] Failed to block user", error);
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const unblock = useMutation({
    mutationFn: async () => {
      if (!userId || !otherUserId) {
        throw new Error("Missing user ids for unblock operation.");
      }

      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", userId)
        .eq("blocked_id", otherUserId);

      if (error) {
        console.error("[useBlockStatus] Failed to unblock user", error);
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const youBlocked = query.data?.youBlocked ?? false;
  const blockedYou = query.data?.blockedYou ?? false;
  const isBlocked = youBlocked || blockedYou;
  const isMutating = block.isPending || unblock.isPending;

  return {
    youBlocked,
    blockedYou,
    isBlocked,
    isLoading: query.isLoading || isMutating,
    isError: query.isError,
    error: query.error ?? null,
    block,
    unblock,
  };
};
