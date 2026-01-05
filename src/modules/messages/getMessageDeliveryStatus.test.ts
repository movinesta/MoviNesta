import { describe, expect, it } from "vitest";
import type {
  ConversationMessage,
  MessageDeliveryReceipt,
  ConversationReadReceipt,
} from "./messageModel";
import type { ConversationListItem } from "./useConversations";
import { getMessageDeliveryStatus } from "./getMessageDeliveryStatus";

const makeConversation = (selfId: string, otherIds: string[]): ConversationListItem => ({
  id: "c1",
  isGroup: otherIds.length > 1,
  title: "Test",
  subtitle: "",
  participants: [
    { id: selfId, displayName: "Me", username: "me", avatarUrl: null, isSelf: true },
    ...otherIds.map((id, idx) => ({
      id,
      displayName: `Other ${idx + 1}`,
      username: `o${idx + 1}`,
      avatarUrl: null,
      isSelf: false,
    })),
  ],
  lastMessagePreview: null,
  lastMessageAt: null,
  lastMessageAtLabel: null,
  lastMessageId: null,
  hasUnread: false,
  lastMessageIsFromSelf: true,
  lastMessageSeenByOthers: false,
  isMuted: false,
  mutedUntil: null,
  isHidden: false,
});

const makeMessage = (senderId: string, createdAt: string): ConversationMessage => ({
  id: "m1",
  conversationId: "c1",
  senderId,
  createdAt,
  body: "hi",
  attachmentUrl: null,
});

describe("getMessageDeliveryStatus", () => {
  it("returns sent when only some recipients have delivery receipts in a group", () => {
    const selfId = "u1";
    const others = ["u2", "u3"];
    const conversation = makeConversation(selfId, others);
    const message = makeMessage(selfId, "2025-01-01T00:00:00Z");

    const deliveryReceipts: MessageDeliveryReceipt[] = [
      {
        id: "r1",
        conversationId: "c1",
        messageId: "m1",
        userId: "u2",
        deliveredAt: "2025-01-01T00:00:05Z",
      },
    ];

    const status = getMessageDeliveryStatus(
      message,
      conversation,
      deliveryReceipts,
      [],
      selfId,
      {},
    );
    expect(status?.status).toBe("sent");
  });

  it("returns delivered when all recipients have delivery receipts (dm and group)", () => {
    const selfId = "u1";
    const others = ["u2", "u3"];
    const conversation = makeConversation(selfId, others);
    const message = makeMessage(selfId, "2025-01-01T00:00:00Z");

    const deliveryReceipts: MessageDeliveryReceipt[] = [
      {
        id: "r1",
        conversationId: "c1",
        messageId: "m1",
        userId: "u2",
        deliveredAt: "2025-01-01T00:00:05Z",
      },
      {
        id: "r2",
        conversationId: "c1",
        messageId: "m1",
        userId: "u3",
        deliveredAt: "2025-01-01T00:00:06Z",
      },
    ];

    const status = getMessageDeliveryStatus(
      message,
      conversation,
      deliveryReceipts,
      [],
      selfId,
      {},
    );
    expect(status?.status).toBe("delivered");
  });

  it("returns seen only when all recipients have read receipts at/after the message time", () => {
    const selfId = "u1";
    const others = ["u2", "u3"];
    const conversation = makeConversation(selfId, others);
    const message = makeMessage(selfId, "2025-01-01T00:00:00Z");

    const deliveryReceipts: MessageDeliveryReceipt[] = [
      {
        id: "r1",
        conversationId: "c1",
        messageId: "m1",
        userId: "u2",
        deliveredAt: "2025-01-01T00:00:05Z",
      },
      {
        id: "r2",
        conversationId: "c1",
        messageId: "m1",
        userId: "u3",
        deliveredAt: "2025-01-01T00:00:06Z",
      },
    ];

    const partialRead: ConversationReadReceipt[] = [
      { userId: "u2", lastReadAt: "2025-01-01T00:00:10Z", lastReadMessageId: null },
    ];
    const status1 = getMessageDeliveryStatus(
      message,
      conversation,
      deliveryReceipts,
      partialRead,
      selfId,
      {},
    );
    expect(status1?.status).toBe("delivered");

    const allRead: ConversationReadReceipt[] = [
      { userId: "u2", lastReadAt: "2025-01-01T00:00:10Z", lastReadMessageId: null },
      { userId: "u3", lastReadAt: "2025-01-01T00:00:12Z", lastReadMessageId: null },
    ];
    const status2 = getMessageDeliveryStatus(
      message,
      conversation,
      deliveryReceipts,
      allRead,
      selfId,
      {},
    );
    expect(status2?.status).toBe("seen");
  });

  it("uses the latest read receipt timestamp when duplicates exist for a user", () => {
    const selfId = "u1";
    const others = ["u2"];
    const conversation = makeConversation(selfId, others);
    const message = makeMessage(selfId, "2025-01-01T00:00:00Z");

    const deliveryReceipts: MessageDeliveryReceipt[] = [
      {
        id: "r1",
        conversationId: "c1",
        messageId: "m1",
        userId: "u2",
        deliveredAt: "2025-01-01T00:00:05Z",
      },
    ];

    const readReceipts: ConversationReadReceipt[] = [
      { userId: "u2", lastReadAt: "2024-12-31T23:59:59Z", lastReadMessageId: null },
      { userId: "u2", lastReadAt: "2025-01-01T00:00:10Z", lastReadMessageId: null },
    ];

    const status = getMessageDeliveryStatus(
      message,
      conversation,
      deliveryReceipts,
      readReceipts,
      selfId,
      {},
    );
    expect(status?.status).toBe("seen");
  });
});
