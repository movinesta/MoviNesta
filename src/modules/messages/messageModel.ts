import type { Database } from "@/types/supabase";
import { formatDate, formatTime } from "@/utils/format";

export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type ReadReceiptRow = Database["public"]["Tables"]["message_read_receipts"]["Row"];
export type DeliveryReceiptRow = Database["public"]["Tables"]["message_delivery_receipts"]["Row"];
export type MessageReactionRow = Database["public"]["Tables"]["message_reactions"]["Row"];

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  createdAt: string;
  body: string | null;
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
    ? "bg-primary text-primary-foreground"
    : "bg-muted text-foreground";

  return {
    bubbleColors: isDeleted
      ? "bg-muted text-muted-foreground border border-dashed border-border"
      : baseBubbleColors,
    bubbleShape: isSelf
      ? "rounded-tr-3xl rounded-tl-3xl rounded-bl-3xl rounded-br-2xl"
      : "rounded-tr-3xl rounded-tl-3xl rounded-br-3xl rounded-bl-2xl",
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

export const mapReactionRowToMessageReaction = (
  row: MessageReactionRow,
): MessageReaction => ({
  id: row.id,
  conversationId: row.conversation_id,
  messageId: row.message_id,
  userId: row.user_id,
  emoji: row.emoji,
  createdAt: row.created_at,
});
