import { useEffect, useMemo, useState } from "react";

import type { ConversationListItem } from "./useConversations";
import type { ConversationReadReceipt, ConversationMessage } from "./messageModel";

/**
 * Computes the "new messages" divider index using the user's last-read pointer
 * as it existed when they opened the conversation.
 */
export const useConversationUnreadDivider = ({
  conversationId,
  userId,
  conversation,
  readReceipts,
  visibleMessages,
}: {
  conversationId: string | null;
  userId: string | null;
  conversation: ConversationListItem | null;
  readReceipts: ConversationReadReceipt[] | undefined;
  visibleMessages: Array<{ message: ConversationMessage }>;
}) => {
  // Keep these stable so we can render the divider even after we mark the thread read.
  const [initialLastReadMessageId, setInitialLastReadMessageId] = useState<
    string | null | undefined
  >(undefined);
  const [initialHasUnread, setInitialHasUnread] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setInitialLastReadMessageId(undefined);
    setInitialHasUnread(undefined);
  }, [conversationId, userId]);

  useEffect(() => {
    if (!conversationId || !userId) return;
    if (initialLastReadMessageId !== undefined) return;
    const mine = (readReceipts ?? []).find((r) => r.userId === userId) ?? null;
    setInitialLastReadMessageId(mine?.lastReadMessageId ?? null);
  }, [conversationId, initialLastReadMessageId, readReceipts, userId]);

  useEffect(() => {
    if (!conversationId || !userId) return;
    if (initialHasUnread !== undefined) return;
    if (!conversation) return;
    setInitialHasUnread(Boolean(conversation.hasUnread));
  }, [conversation, conversationId, initialHasUnread, userId]);

  const firstUnreadIndex = useMemo(() => {
    if (initialHasUnread === undefined) return null;
    if (!initialHasUnread) return null;
    if (visibleMessages.length === 0) return null;

    if (initialLastReadMessageId === undefined) return null;
    if (initialLastReadMessageId === null) return 0;

    const idx = visibleMessages.findIndex((m) => m.message.id === initialLastReadMessageId);
    if (idx < 0) return 0;
    const next = idx + 1;
    if (next >= visibleMessages.length) return null;
    return next;
  }, [initialHasUnread, initialLastReadMessageId, visibleMessages]);

  return {
    firstUnreadIndex,
    lastReadMessageId: initialLastReadMessageId ?? null,
    hasUnread: Boolean(initialHasUnread),
  };
};
