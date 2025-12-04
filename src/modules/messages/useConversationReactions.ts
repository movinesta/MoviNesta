import { useMemo } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import { useAuth } from "../auth/AuthProvider";
import type { MessageReaction, ReactionSummary } from "./messageModel";

export const conversationReactionsQueryKey = (conversationId: string | null) =>
  ["conversation", conversationId, "reactions"] as const;

type MessageReactionRow = Database["public"]["Tables"]["message_reactions"]["Row"];

const mapReactionRow = (row: MessageReactionRow): MessageReaction => ({
  id: row.id,
  conversationId: row.conversation_id,
  messageId: row.message_id,
  userId: row.user_id,
  emoji: row.emoji,
  createdAt: row.created_at,
});

const fetchConversationReactions = async (
  conversationId: string,
): Promise<MessageReaction[]> => {
  const { data, error } = await supabase
    .from("message_reactions")
    .select("id, conversation_id, message_id, user_id, emoji, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<MessageReactionRow[]>();

  if (error) {
    console.error("[useConversationReactions] Failed to load reactions", error);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapReactionRow);
};

export const useConversationReactions = (conversationId: string | null) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = conversationReactionsQueryKey(conversationId);

  const reactionsQuery = useQuery<MessageReaction[]>({
    queryKey,
    enabled: Boolean(conversationId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: conversationId ? 15000 : false,
    refetchIntervalInBackground: true,
    queryFn: () => {
      if (!conversationId) return Promise.resolve([]);
      return fetchConversationReactions(conversationId);
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!conversationId) throw new Error("Missing conversation id.");
      if (!userId) throw new Error("You must be signed in to react to messages.");

      const { error } = await supabase.from("message_reactions").insert({
        conversation_id: conversationId,
        message_id: messageId,
        user_id: userId,
        emoji,
      });

      if (error) {
        if ((error as PostgrestError)?.code === "23505") {
          const { error: deleteError } = await supabase
            .from("message_reactions")
            .delete()
            .eq("conversation_id", conversationId)
            .eq("message_id", messageId)
            .eq("user_id", userId)
            .eq("emoji", emoji);

          if (deleteError) {
            console.error("[useConversationReactions] Failed to remove reaction", deleteError);
            throw deleteError;
          }
          return;
        }

        console.error("[useConversationReactions] Failed to toggle reaction", error);
        throw error;
      }
    },
    onMutate: async ({ messageId, emoji }) => {
      if (!conversationId || !userId) {
        return { previousReactions: undefined as MessageReaction[] | undefined };
      }

      await queryClient.cancelQueries({ queryKey });
      const previousReactions = queryClient.getQueryData<MessageReaction[]>(queryKey);

      queryClient.setQueryData<MessageReaction[]>(queryKey, (existing) => {
        const current = existing ?? [];
        const existingIdx = current.findIndex(
          (r) => r.messageId === messageId && r.userId === userId && r.emoji === emoji,
        );

        if (existingIdx >= 0) {
          const next = [...current];
          next.splice(existingIdx, 1);
          return next;
        }

        const optimistic: MessageReaction = {
          id: `temp-${Date.now()}`,
          conversationId,
          messageId,
          userId,
          emoji,
          createdAt: new Date().toISOString(),
        };
        return [...current, optimistic];
      });

      return { previousReactions };
    },
    onError: (_error, _variables, context) => {
      if (!conversationId) return;
      if (context?.previousReactions) {
        queryClient.setQueryData(queryKey, context.previousReactions);
      } else {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onSuccess: () => {
      if (!conversationId) return;
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, ReactionSummary[]>();
    const reactions = reactionsQuery.data ?? [];

    for (const reaction of reactions) {
      const existing = map.get(reaction.messageId) ?? [];
      let entry = existing.find((e) => e.emoji === reaction.emoji);
      if (entry) {
        entry.count += 1;
        entry.reactedBySelf = entry.reactedBySelf || (userId ? reaction.userId === userId : false);
      } else {
        entry = {
          count: 1,
          emoji: reaction.emoji,
          reactedBySelf: Boolean(userId && reaction.userId === userId),
        };
        existing.push(entry);
      }
      map.set(reaction.messageId, existing);
    }

    return map;
  }, [reactionsQuery.data, userId]);

  return {
    reactions: reactionsQuery.data ?? [],
    reactionsByMessageId,
    isLoadingReactions: reactionsQuery.isLoading,
    toggleReaction,
    queryKey,
  } as const;
};
