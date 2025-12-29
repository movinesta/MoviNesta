import { formatDate, formatTime } from "@/utils/format";

// Tables missing from generated types, defining manually
export type MessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  created_at: string;
  body: any; // JSON
  attachment_url: string | null;
  message_type?: string;
  client_id?: string;
  text?: string;
};

export type ReadReceiptRow = {
  conversation_id: string;
  user_id: string;
  last_read_message_id: string | null;
  last_read_at: string | null;
};

export type DeliveryReceiptRow = {
  id: string;
  conversation_id: string;
  message_id: string;
  user_id: string;
  delivered_at: string | null;
  created_at: string | null;
};

export type MessageReactionRow = {
  id: string;
  conversation_id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  createdAt: string;
  body: any; // JSON or string
  attachmentUrl: string | null;
}

export interface ConversationReadReceipt {
  userId: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
}

export interface MessageReaction {
  id: MessageReactionRow["id"];
  conversationId: MessageReactionRow["conversation_id"];
  messageId: MessageReactionRow["message_id"];
  userId: MessageReactionRow["user_id"];
  emoji: MessageReactionRow["emoji"];
  createdAt: MessageReactionRow["created_at"];
}

export type ReactionSummary = { emoji: string; count: number; reactedBySelf: boolean };

export interface MessageDeliveryReceipt {
  id: string;
  conversationId: string;
  messageId: string;
  userId: string;
  deliveredAt: string;
}

export type MessageDeliveryStatusValue = "sending" | "sent" | "delivered" | "seen" | "failed";

export interface MessageDeliveryStatus {
  status: MessageDeliveryStatusValue;
  seenAt?: string | null;
}

export type FailedMessagePayload = {
  text: string;
  attachmentPath: string | null;
  clientId: string;
};

export const getBubbleAppearance = ({
  isSelf,
  isDeleted,
}: {
  isSelf: boolean;
  isDeleted: boolean;
}) => {
  const baseBubbleColors = isSelf
    ? "bg-primary text-white shadow-[0_0_20px_-6px_rgba(127,19,236,0.5)]"
    : "bg-card text-foreground border border-border/60";

  return {
    bubbleColors: isDeleted
      ? "bg-muted text-muted-foreground border border-dashed border-border"
      : baseBubbleColors,
    bubbleShape: isSelf ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-tl-sm",
  };
};

export const formatMessageTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatTime(date, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export const isSameCalendarDate = (a: Date, b: Date): boolean => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

export const formatMessageDateLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDate(date, today)) {
    return "Today";
  }

  if (isSameCalendarDate(date, yesterday)) {
    return "Yesterday";
  }

  return formatDate(date, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const isWithinGroupingWindow = (
  olderIso: string,
  newerIso: string,
  maxGapMs = 3 * 60 * 1000,
): boolean => {
  const older = new Date(olderIso);
  const newer = new Date(newerIso);
  if (Number.isNaN(older.getTime()) || Number.isNaN(newer.getTime())) {
    return false;
  }
  return newer.getTime() - older.getTime() <= maxGapMs;
};

export const mapMessageRowToConversationMessage = (row: MessageRow): ConversationMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.user_id,
  body: row.body ?? null,
  attachmentUrl: row.attachment_url ?? null,
  createdAt: row.created_at ?? new Date().toISOString(),
});

export const mapReadReceiptRowToConversationReadReceipt = (
  row: ReadReceiptRow,
): ConversationReadReceipt => ({
  userId: row.user_id,
  lastReadAt: row.last_read_at ?? null,
  lastReadMessageId: row.last_read_message_id ?? null,
});

export const mapDeliveryReceiptRowToMessageDeliveryReceipt = (
  row: DeliveryReceiptRow,
): MessageDeliveryReceipt => ({
  id: row.id,
  conversationId: row.conversation_id,
  messageId: row.message_id,
  userId: row.user_id,
  deliveredAt: row.delivered_at ?? row.created_at ?? new Date().toISOString(),
});

export const mapReactionRowToMessageReaction = (row: MessageReactionRow): MessageReaction => ({
  id: row.id,
  conversationId: row.conversation_id,
  messageId: row.message_id,
  userId: row.user_id,
  emoji: row.emoji,
  createdAt: row.created_at,
});
