import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  mapDeliveryReceiptRowToMessageDeliveryReceipt,
  mapReadReceiptRowToConversationReadReceipt,
  type ConversationReadReceipt,
  type DeliveryReceiptRow,
  type MessageDeliveryReceipt,
  type ReadReceiptRow,
} from "./messageModel";
import { messageDeliveryReceiptsQueryKey, conversationReadReceiptsQueryKey } from "./queryKeys";
import {
  fetchConversationDeliveryReceipts,
  fetchConversationReadReceipts,
} from "./supabaseConversationQueries";
import { getStringField } from "./realtimeGuards";
import { useConversationRealtimeSubscription } from "./useConversationRealtimeSubscription";
import { useRealtimeQueryFallbackOptions } from "./useRealtimeQueryFallbackOptions";
import { normalizeIdList } from "./idUtils";
import { createConversationScopedUpsertIntoListHandler } from "./realtimeListUpdaters";

export const useConversationReadReceipts = (conversationId: string | null) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => conversationReadReceiptsQueryKey(conversationId),
    [conversationId],
  );
  const { pollWhenRealtimeDown, onRealtimeStatus, refetchOptions } =
    useRealtimeQueryFallbackOptions(conversationId);

  const query = useQuery<ConversationReadReceipt[]>({
    queryKey,
    enabled: Boolean(conversationId),
    ...refetchOptions,
    queryFn: async (): Promise<ConversationReadReceipt[]> => {
      if (!conversationId) return [];
      return fetchConversationReadReceipts(conversationId);
    },
  });
  const createReadReceiptHandlers = useCallback(() => {
    if (!conversationId) return {};

    const upsert = createConversationScopedUpsertIntoListHandler<
      ReadReceiptRow,
      ConversationReadReceipt
    >({
      conversationId,
      queryClient,
      queryKey,
      mapRow: mapReadReceiptRowToConversationReadReceipt,
      key: (r) => r.userId,
      // Ensure the row has the fields we require before casting.
      getRequiredId: (rowUnknown) => getStringField(rowUnknown, "user_id"),
      // sort by lastReadAt desc (nulls last)
      sort: (a, b) => {
        const aNull = !a.lastReadAt;
        const bNull = !b.lastReadAt;
        if (aNull && bNull) return 0;
        if (aNull) return 1; // nulls last
        if (bNull) return -1;
        const at = new Date(a.lastReadAt!).getTime();
        const bt = new Date(b.lastReadAt!).getTime();
        if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
        if (Number.isNaN(at)) return 1;
        if (Number.isNaN(bt)) return -1;
        return bt - at;
      },
    });

    return {
      onStatus: onRealtimeStatus,
      onReadReceiptUpsert: upsert,
    };
  }, [conversationId, onRealtimeStatus, queryClient, queryKey]);

  useConversationRealtimeSubscription(conversationId, createReadReceiptHandlers, []);

  return useMemo(
    () => ({
      ...query,
      pollWhenRealtimeDown,
      queryKey,
    }),
    [query, pollWhenRealtimeDown, queryKey],
  );
};

export const useConversationDeliveryReceipts = (
  conversationId: string | null,
  messageIds: string[],
) => {
  const queryClient = useQueryClient();
  const normalizedMessageIds = useMemo(() => {
    return normalizeIdList(messageIds, { excludeTemp: true, sort: true });
  }, [messageIds]);

  const queryKey = useMemo(
    () => messageDeliveryReceiptsQueryKey(conversationId, normalizedMessageIds),
    [conversationId, normalizedMessageIds],
  );
  const { pollWhenRealtimeDown, onRealtimeStatus, refetchOptions } =
    useRealtimeQueryFallbackOptions(conversationId);

  const query = useQuery<MessageDeliveryReceipt[]>({
    queryKey,
    enabled: Boolean(conversationId && normalizedMessageIds.length > 0),
    ...refetchOptions,
    queryFn: async (): Promise<MessageDeliveryReceipt[]> => {
      if (!conversationId) return [];

      // If the caller passed an explicit list of message ids, and it normalized to an empty list,
      // short-circuit: there\'s nothing to load.
      if (normalizedMessageIds.length === 0) return [];

      return fetchConversationDeliveryReceipts(conversationId, normalizedMessageIds);
    },
  });
  const createDeliveryReceiptHandlers = useCallback(() => {
    if (!conversationId) return {};
    if (normalizedMessageIds.length === 0) return {};

    const allowedMessageIdSet = new Set(normalizedMessageIds);

    const upsert = createConversationScopedUpsertIntoListHandler<
      DeliveryReceiptRow,
      MessageDeliveryReceipt
    >({
      conversationId,
      queryClient,
      queryKey,
      mapRow: mapDeliveryReceiptRowToMessageDeliveryReceipt,
      key: (r) => r.id,
      extraGuard: (rowUnknown) => {
        const messageId = getStringField(rowUnknown, "message_id");
        return Boolean(messageId && allowedMessageIdSet.has(messageId));
      },
      sort: (a, b) => {
        const at = new Date(a.deliveredAt ?? "").getTime();
        const bt = new Date(b.deliveredAt ?? "").getTime();
        const aSafe = Number.isNaN(at) ? 0 : at;
        const bSafe = Number.isNaN(bt) ? 0 : bt;
        return aSafe - bSafe;
      },
    });

    return {
      onStatus: onRealtimeStatus,
      onDeliveryReceiptUpsert: upsert,
    };
  }, [conversationId, normalizedMessageIds, onRealtimeStatus, queryClient, queryKey]);

  const realtimeConversationId =
    conversationId && normalizedMessageIds.length > 0 ? conversationId : null;
  useConversationRealtimeSubscription(realtimeConversationId, createDeliveryReceiptHandlers, []);

  return useMemo(
    () => ({
      ...query,
      pollWhenRealtimeDown,
      queryKey,
    }),
    [query, pollWhenRealtimeDown, queryKey],
  );
};
