import { useCallback, useMemo } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import {
  mapReactionRowToMessageReaction,
  type MessageReaction,
  type MessageReactionRow,
} from "./messageModel";
import { conversationReactionsQueryKey } from "./queryKeys";
import { fetchConversationReactions } from "./supabaseConversationQueries";
import { safeTime } from "./time";
import { buildReactionSummariesByMessageId } from "./reactionSummaries";
import { useConversationRealtimeSubscription } from "./useConversationRealtimeSubscription";
import { useRealtimeQueryFallbackOptions } from "./useRealtimeQueryFallbackOptions";
import { createTimestampTempId } from "./idUtils";
import {
  createConversationScopedUpsertIntoListHandler,
  createRealtimeDeleteFromListHandler,
} from "./realtimeListUpdaters";

export const useConversationReactions = (conversationId: string | null) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => conversationReactionsQueryKey(conversationId), [conversationId]);

  const { pollWhenRealtimeDown, onRealtimeStatus, refetchOptions } =
    useRealtimeQueryFallbackOptions(conversationId);

  const reactionsQuery = useQuery<MessageReaction[]>({
    queryKey,
    enabled: Boolean(conversationId),
    ...refetchOptions,
    queryFn: () => {
      if (!conversationId) return Promise.resolve([]);
      return fetchConversationReactions(conversationId);
    },
  });

  const createRealtimeHandlers = useCallback(() => {
    if (!conversationId) return {};

    const upsert = createConversationScopedUpsertIntoListHandler<
      MessageReactionRow,
      MessageReaction
    >({
      conversationId,
      queryClient,
      queryKey,
      mapRow: mapReactionRowToMessageReaction,
      key: (r) => r.id,
      sort: (a, b) => {
        const at = safeTime(a.createdAt);
        const bt = safeTime(b.createdAt);
        if (at !== bt) return at - bt;
        return a.id.localeCompare(b.id);
      },
    });

    const remove = createRealtimeDeleteFromListHandler<MessageReactionRow, MessageReaction>({
      queryClient,
      queryKey,
      key: (r) => r.id,
    });

    return {
      onStatus: onRealtimeStatus,
      onReactionUpsert: upsert,
      onReactionDelete: remove,
    };
  }, [conversationId, onRealtimeStatus, queryClient, queryKey]);

  useConversationRealtimeSubscription(conversationId, createRealtimeHandlers, []);

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!conversationId) throw new Error("Missing conversation id.");
      if (!userId) throw new Error("You must be signed in to react to messages.");

      const { error } = await supabase.from("message_reactions").insert(
        {
        conversation_id: conversationId,
        message_id: messageId,
        user_id: userId,
        emoji,
        },
        { returning: "minimal" },
      );

      if (error) {
        if ((error as PostgrestError)?.code === "23505") {
          const { error: deleteError } = await supabase
            .from("message_reactions")
            .delete({ returning: "minimal" })
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
          id: createTimestampTempId(),
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
      // Realtime should bring us in sync quickly; this is a safety net.
      if (!conversationId) return;
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const reactionsByMessageId = useMemo(() => {
    const reactions = reactionsQuery.data ?? [];
    return buildReactionSummariesByMessageId(reactions, userId);
  }, [reactionsQuery.data, userId]);

  return {
    reactions: reactionsQuery.data ?? [],
    reactionsByMessageId,
    isLoadingReactions: reactionsQuery.isLoading,
    toggleReaction,
    pollWhenRealtimeDown,
    queryKey,
  } as const;
};
