import type { Database } from "@/types/supabase";
import { formatDate, formatTime } from "@/utils/format";

export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

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
  id: string;
  conversationId: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

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
};

export const getBubbleAppearance = ({
  isSelf,
  isDeleted,
}: {
  isSelf: boolean;
  isDeleted: boolean;
}) => {
  const baseBubbleColors = isSelf
    ? "bg-mn-primary/90 text-white shadow-md shadow-mn-primary/20"
    : "bg-mn-bg-elevated text-mn-text-primary border border-mn-border-subtle/80 shadow-mn-soft";

  return {
    bubbleColors: isDeleted
      ? "bg-mn-bg-elevated/80 text-mn-text-muted border border-dashed border-mn-border-subtle/80"
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

export const mapMessageRowToConversationMessage = (
  row: MessageRow,
): ConversationMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.user_id,
  body: row.body ?? null,
  attachmentUrl: row.attachment_url ?? null,
  createdAt: row.created_at ?? new Date().toISOString(),
});
