import { useMemo } from "react";

import type { ConversationListItem, ConversationParticipant } from "./useConversations";
import type {
  ConversationMessage,
  ConversationReadReceipt,
  FailedMessagePayload,
  MessageDeliveryReceipt,
  MessageDeliveryStatus,
  ReactionSummary,
} from "./messageModel";
import { getMessageMeta } from "./messageText";
import { createMessageDeliveryStatusResolver } from "./getMessageDeliveryStatus";

export interface UiMessage {
  message: ConversationMessage;
  meta: ReturnType<typeof getMessageMeta>;
  sender: ConversationParticipant | null;
  isSelf: boolean;
  deliveryStatus: MessageDeliveryStatus | null;
  showDeliveryStatus: boolean;
  reactions: ReactionSummary[];
}

export function useConversationUiMessages(args: {
  messages: ConversationMessage[] | undefined;
  conversation: ConversationListItem | null;
  currentUserId: string | null;
  participantsById: Map<string, ConversationParticipant>;
  reactionsByMessageId: Map<string, ReactionSummary[]>;
  hiddenMessageIds: Record<string, boolean>;

  deliveryReceipts: MessageDeliveryReceipt[] | undefined;
  readReceipts: ConversationReadReceipt[] | undefined;

  failedMessages: Record<string, FailedMessagePayload>;
  lastOwnMessageId: string | null;
}) {
  const {
    messages,
    conversation,
    currentUserId,
    participantsById,
    reactionsByMessageId,
    hiddenMessageIds,
    deliveryReceipts,
    readReceipts,
    failedMessages,
    lastOwnMessageId,
  } = args;

  const uiMessages = useMemo<UiMessage[]>(() => {
    if (!messages) return [];

    // Perf: delivery/read receipts can be large. We only compute delivery status for
    // the last visible outgoing message (for the footer label), plus any failed optimistic messages.
    const messageIdsNeedingStatus = new Set<string>();
    if (lastOwnMessageId) messageIdsNeedingStatus.add(lastOwnMessageId);
    for (const id of Object.keys(failedMessages)) {
      messageIdsNeedingStatus.add(id);
    }

    const messageCreatedAtMsById = new Map<string, number>();
    for (const m of messages) {
      const ms = new Date(m.createdAt ?? "").getTime();
      if (!Number.isNaN(ms)) messageCreatedAtMsById.set(m.id, ms);
    }

    const resolveDeliveryStatus = createMessageDeliveryStatusResolver({
      conversation: conversation ?? null,
      deliveryReceipts,
      readReceipts,
      currentUserId,
      failedMessages,
      onlyMessageIds: messageIdsNeedingStatus,
      messageCreatedAtMsById,
    });

    return messages.map((message) => {
      const meta = getMessageMeta(message.body);
      const sender = participantsById.get(message.senderId) ?? null;

      const isSelf =
        sender?.isSelf ?? (currentUserId != null && message.senderId === currentUserId);

      const deliveryStatus =
        isSelf && messageIdsNeedingStatus.has(message.id) ? resolveDeliveryStatus(message) : null;

      const showDeliveryStatus =
        !!deliveryStatus &&
        isSelf &&
        !meta.deleted &&
        (deliveryStatus.status === "failed" || lastOwnMessageId === message.id);

      return {
        message,
        meta,
        sender,
        isSelf,
        deliveryStatus,
        showDeliveryStatus,
        reactions: reactionsByMessageId.get(message.id) ?? [],
      };
    });
  }, [
    conversation,
    currentUserId,
    deliveryReceipts,
    failedMessages,
    lastOwnMessageId,
    messages,
    participantsById,
    reactionsByMessageId,
    readReceipts,
  ]);

  const visibleMessages = useMemo(
    () => uiMessages.filter(({ message }) => !hiddenMessageIds[message.id]),
    [uiMessages, hiddenMessageIds],
  );

  return { uiMessages, visibleMessages };
}
