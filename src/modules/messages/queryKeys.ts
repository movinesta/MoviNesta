export const conversationsQueryKey = ["conversations"] as const;

export const conversationMessagesQueryKey = (conversationId: string | null) =>
  ["conversation", conversationId, "messages"] as const;

export const conversationReadReceiptsQueryKey = (conversationId: string | null) =>
  ["conversation", conversationId, "readReceipts"] as const;


export const messageDeliveryReceiptsQueryKey = (
  conversationId: string | null,
  messageIds: string[],
) => ["conversation", conversationId, "deliveryReceipts", "messageIds", messageIds] as const;

export const conversationReactionsQueryKey = (conversationId: string | null) =>
  ["conversation", conversationId, "reactions"] as const;
