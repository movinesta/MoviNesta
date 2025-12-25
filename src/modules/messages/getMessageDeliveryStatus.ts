import type {
  ConversationMessage,
  ConversationReadReceipt,
  FailedMessagePayload,
  MessageDeliveryReceipt,
  MessageDeliveryStatus,
} from "./messageModel";
import type { ConversationListItem } from "./useConversations";
import { isTempId } from "./idUtils";

export type MessageDeliveryStatusResolver = (
  message: ConversationMessage,
) => MessageDeliveryStatus | null;

export function createMessageDeliveryStatusResolver(args: {
  conversation: ConversationListItem | null;
  deliveryReceipts: MessageDeliveryReceipt[] | undefined;
  readReceipts: ConversationReadReceipt[] | undefined;
  currentUserId: string | null | undefined;
  failedMessages: Record<string, FailedMessagePayload>;
  /**
   * Optional optimization: if provided, delivery receipts are only indexed for these message IDs.
   * Read receipts are always indexed (they're keyed by user, not message).
   */
  onlyMessageIds?: Set<string>;
  /**
   * Optional optimization/accuracy: map of messageId -> createdAt(ms). When provided,
   * we prefer lastReadMessageId to determine what a user has read.
   */
  messageCreatedAtMsById?: Map<string, number>;
}): MessageDeliveryStatusResolver {
  const {
    conversation,
    deliveryReceipts,
    readReceipts,
    currentUserId,
    failedMessages,
    onlyMessageIds,
    messageCreatedAtMsById,
  } = args;

  if (!conversation || !currentUserId) return () => null;

  const others = conversation.participants.filter((p) => !p.isSelf);
  if (others.length === 0) return () => null;

  const otherIdSet = new Set(others.map((p) => p.id));

  const messageMsForId = (id: string | null | undefined): number | null => {
    if (!id) return null;
    const fromMap = messageCreatedAtMsById?.get(id);
    if (fromMap != null) return fromMap;
    return null;
  };

  // userId -> ms marker indicating "read up to"
  const readMarkerMsByUserId = new Map<string, number>();
  for (const r of readReceipts ?? []) {
    let markerMs: number | null = null;

    if (r.lastReadMessageId) {
      const msgMs = messageMsForId(r.lastReadMessageId);
      if (msgMs != null) markerMs = msgMs;
    }

    if (markerMs == null && r.lastReadAt) {
      const ms = new Date(r.lastReadAt).getTime();
      if (!Number.isNaN(ms)) markerMs = ms;
    }

    if (markerMs == null) continue;

    const prev = readMarkerMsByUserId.get(r.userId);
    if (prev == null || markerMs > prev) {
      readMarkerMsByUserId.set(r.userId, markerMs);
    }
  }

  // messageId -> set(otherUserId)
  const deliveredOtherUserIdsByMessageId = new Map<string, Set<string>>();
  for (const r of deliveryReceipts ?? []) {
    if (!otherIdSet.has(r.userId)) continue;
    if (onlyMessageIds && !onlyMessageIds.has(r.messageId)) continue;

    let set = deliveredOtherUserIdsByMessageId.get(r.messageId);
    if (!set) {
      set = new Set<string>();
      deliveredOtherUserIdsByMessageId.set(r.messageId, set);
    }
    set.add(r.userId);
  }

  return (message) => {
    if (message.senderId !== currentUserId) return null;

    if (failedMessages[message.id]) {
      return { status: "failed" };
    }

    if (isTempId(message.id)) {
      return { status: "sending" };
    }

    const messageTimeMs = (() => {
      const t = new Date(message.createdAt ?? "").getTime();
      return Number.isNaN(t) ? 0 : t;
    })();

    let seenCount = 0;
    let latestSeenAtMs: number | null = null;

    for (const other of others) {
      const markerMs = readMarkerMsByUserId.get(other.id);
      if (markerMs == null) continue;

      if (markerMs >= messageTimeMs) {
        seenCount += 1;
        if (latestSeenAtMs === null || markerMs > latestSeenAtMs) {
          latestSeenAtMs = markerMs;
        }
      }
    }

    if (seenCount === others.length && others.length > 0) {
      const seenAtIso = latestSeenAtMs != null ? new Date(latestSeenAtMs).toISOString() : null;
      return { status: "seen", seenAt: seenAtIso };
    }

    const deliveredCount = deliveredOtherUserIdsByMessageId.get(message.id)?.size ?? 0;
    if (deliveredCount === others.length && others.length > 0) {
      return { status: "delivered" };
    }

    return { status: "sent" };
  };
}

export const getMessageDeliveryStatus = (
  message: ConversationMessage,
  conversation: ConversationListItem | null,
  deliveryReceipts: MessageDeliveryReceipt[] | undefined,
  readReceipts: ConversationReadReceipt[] | undefined,
  currentUserId: string | null | undefined,
  failedMessages: Record<string, FailedMessagePayload>,
): MessageDeliveryStatus | null => {
  const resolver = createMessageDeliveryStatusResolver({
    conversation,
    deliveryReceipts,
    readReceipts,
    currentUserId,
    failedMessages,
  });
  return resolver(message);
};
