export const conversationsQueryKey = (userId: string | null | undefined) =>
  ["conversations", userId ?? "anon"] as const;

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

export const assistantReplyStatusQueryKey = (conversationId: string | null) =>
  ["conversation", conversationId, "assistantReplyStatus"] as const;
