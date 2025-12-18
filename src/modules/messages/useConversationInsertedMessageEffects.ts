import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConversationMessage } from "./messageModel";
import { getMessagePreview } from "./messageText";
import { formatTimeAgo } from "./formatTimeAgo";
import { updateConversationListItemInCache } from "./conversationsCache";
import { writeDeliveryReceipt } from "./supabaseReceiptWrites";

/**
 * Side effects to run when a new message is inserted into the local cache.
 *
 * - Updates the inbox list preview so the messages list feels instant.
 * - Upserts a delivery receipt for receivers.
 */
export const useConversationInsertedMessageEffects = ({
  currentUserId,
}: {
  currentUserId: string | null;
}) => {
  const queryClient = useQueryClient();

  return useCallback(
    (message: ConversationMessage) => {
      // Keep inbox list fresh without forcing an immediate refetch (the list is already polled).
      // We still rely on polling/RPC for full correctness, but this makes the UI feel instant.
      updateConversationListItemInCache(
        queryClient,
        message.conversationId,
        (current) => {
          const isFromSelf = Boolean(currentUserId && message.senderId === currentUserId);

          return {
            ...current,
            lastMessagePreview: getMessagePreview(message.body) ?? current.lastMessagePreview,
            lastMessageAt: message.createdAt ?? current.lastMessageAt,
            lastMessageAtLabel: formatTimeAgo(message.createdAt ?? null),
            hasUnread: !isFromSelf,
            lastMessageIsFromSelf: isFromSelf,
            // When you send a message, it isn't seen yet.
            lastMessageSeenByOthers: isFromSelf ? false : current.lastMessageSeenByOthers,
          };
        },
        { moveToTop: true },
      );

      // Insert a delivery receipt on the receiver client.
      if (!currentUserId) return;
      if (message.senderId === currentUserId) return;

      
void writeDeliveryReceipt({
  conversation_id: message.conversationId,
  message_id: message.id,
  user_id: currentUserId,
});
},
    [currentUserId, queryClient],
  );
};
