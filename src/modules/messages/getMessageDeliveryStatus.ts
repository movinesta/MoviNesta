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

  // userId -> marker indicating "read up to" and the time the receipt was written.
  const readMarkerByUserId = new Map<
    string,
    {
      upToMs: number;
      readAtMs: number | null;
    }
  >();
  for (const r of readReceipts ?? []) {
    let upToMs: number | null = null;

    if (r.lastReadMessageId) {
      const msgMs = messageMsForId(r.lastReadMessageId);
      if (msgMs != null) upToMs = msgMs;
      // If the referenced message isn't loaded, avoid falling back to last_read_at.
      if (msgMs == null) upToMs = null;
    } else if (r.lastReadAt) {
      const ms = new Date(r.lastReadAt).getTime();
      if (!Number.isNaN(ms)) upToMs = ms;
    }

    if (upToMs == null) continue;

    const readAtMs = (() => {
      if (!r.lastReadAt) return null;
      const ms = new Date(r.lastReadAt).getTime();
      return Number.isNaN(ms) ? null : ms;
    })();

    const prev = readMarkerByUserId.get(r.userId);
    if (!prev || upToMs > prev.upToMs) {
      readMarkerByUserId.set(r.userId, { upToMs, readAtMs });
      continue;
    }

    // If the range is the same, prefer the newer readAtMs for display.
    if (upToMs === prev.upToMs) {
      if (readAtMs != null && (prev.readAtMs == null || readAtMs > prev.readAtMs)) {
        readMarkerByUserId.set(r.userId, { upToMs, readAtMs });
      }
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
      const marker = readMarkerByUserId.get(other.id);
      if (!marker) continue;

      if (marker.upToMs >= messageTimeMs) {
        seenCount += 1;
        const seenAtMs = marker.readAtMs ?? marker.upToMs;
        if (latestSeenAtMs === null || seenAtMs > latestSeenAtMs) {
          latestSeenAtMs = seenAtMs;
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
