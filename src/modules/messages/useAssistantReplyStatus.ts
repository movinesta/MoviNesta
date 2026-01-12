import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { assistantReplyStatusQueryKey } from "./queryKeys";

export type AssistantReplyStatus = {
  ok: boolean;
  is_typing: boolean;
  is_queued: boolean;
  jobKind?: string | null;
  attempts?: number | null;
  nextRunAt?: string | null;
  retryAfterSec?: number | null;
  code?: string | null;
};

/**
 * Read assistant reply status from the database.
 *
 * This is used to persist "assistant typing" across refreshes and across devices,
 * and avoids relying on static Supabase TS types (schema is migration-driven).
 */
export function useAssistantReplyStatus(conversationId: string | null, enabled: boolean) {
  return useQuery<AssistantReplyStatus | null>({
    queryKey: assistantReplyStatusQueryKey(conversationId),
    enabled: Boolean(conversationId) && enabled,
    staleTime: 1_000,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (d?.is_typing || d?.is_queued) return 2_000;
      return false;
    },
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase.rpc(
        "assistant_reply_status_v1" as any,
        {
          p_conversation_id: conversationId,
        } as any,
      );

      if (error) {
        // If the function doesn't exist yet (older deployments), silently disable.
        const msg = (error.message ?? "").toLowerCase();
        if (msg.includes("does not exist") || msg.includes("function") || msg.includes("schema")) {
          return null;
        }
        throw new Error(error.message);
      }

      return (data ?? null) as any;
    },
  });
}
