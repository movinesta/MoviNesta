import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConversationMessage } from "./messageModel";
import { updateConversationListItemInCache } from "./conversationsCache";
import { writeReadReceipt } from "./supabaseReceiptWrites";
import { isTempId } from "./idUtils";

// Avoid hammering the DB when many messages arrive while the user is reading at the bottom.
const READ_RECEIPT_THROTTLE_MS = 3000;

type PendingReadReceipt = {
  conversationId: string;
  userId: string;
  messageId: string;
};

export function useConversationReadReceiptWriter(args: {
  conversationId: string | null;
  userId: string | null;
  isAtBottom: boolean;
  messages: ConversationMessage[] | undefined;
}) {
  const { conversationId, userId, isAtBottom, messages } = args;
  const queryClient = useQueryClient();

  const lastReadRef = useRef<{
    conversationId: string | null;
    messageId: string | null;
    userId: string | null;
  }>({
    conversationId: null,
    messageId: null,
    userId: null,
  });

  const readReceiptThrottleRef = useRef<{
    lastSentAt: number;
    timeoutId: number | null;
    pending: PendingReadReceipt | null;
  }>({
    lastSentAt: 0,
    timeoutId: null,
    pending: null,
  });

  // Reset on conversation/user changes.
  useEffect(() => {
    lastReadRef.current = { conversationId: null, messageId: null, userId: null };

    const state = readReceiptThrottleRef.current;
    if (state.timeoutId != null) {
      window.clearTimeout(state.timeoutId);
    }
    state.timeoutId = null;
    state.pending = null;
    state.lastSentAt = 0;
  }, [conversationId, userId]);

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      const state = readReceiptThrottleRef.current;
      if (state.timeoutId != null) {
        window.clearTimeout(state.timeoutId);
      }
      state.timeoutId = null;
    };
  }, []);

  // Read receipts (throttled) + inbox cache update.
  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0 || !userId) return;
    if (!isAtBottom) return;

    const last = messages[messages.length - 1];

    // Never write read receipts pointing at optimistic temp IDs.
    if (isTempId(last.id)) return;

    if (
      lastReadRef.current.conversationId === conversationId &&
      lastReadRef.current.messageId === last.id &&
      lastReadRef.current.userId === userId
    ) {
      return;
    }

    const throttle = readReceiptThrottleRef.current;
    const now = Date.now();
    const elapsed = throttle.lastSentAt ? now - throttle.lastSentAt : Number.POSITIVE_INFINITY;

    const markConversationReadInCache = () => {
      updateConversationListItemInCache(queryClient, conversationId, (current) => {
        if (!current.hasUnread) return current;
        return { ...current, hasUnread: false };
      });
    };

    const sendNow = (messageId: string) => {
      throttle.lastSentAt = Date.now();
      const lastReadAt = new Date().toISOString();

      void writeReadReceipt({
        conversation_id: conversationId,
        user_id: userId,
        last_read_message_id: messageId,
        last_read_at: lastReadAt,
      })
        .then(() => {
          lastReadRef.current = { conversationId, messageId, userId };
          markConversationReadInCache();
        })
        .catch((error: unknown) => {
          console.error("[useConversationReadReceiptWriter] Failed to update read receipt", error);
        });
    };

    // Throttle read receipts while still eventually recording the newest message.
    if (elapsed < READ_RECEIPT_THROTTLE_MS) {
      throttle.pending = { conversationId, userId, messageId: last.id };

      if (throttle.timeoutId == null) {
        throttle.timeoutId = window.setTimeout(() => {
          const pending = readReceiptThrottleRef.current.pending;
          readReceiptThrottleRef.current.pending = null;
          readReceiptThrottleRef.current.timeoutId = null;
          if (!pending) return;

          // If we're already up to date, skip.
          if (
            lastReadRef.current.conversationId === pending.conversationId &&
            lastReadRef.current.messageId === pending.messageId &&
            lastReadRef.current.userId === pending.userId
          ) {
            return;
          }

          // Only send if we're still in the same conversation/user context.
          if (pending.conversationId !== conversationId || pending.userId !== userId) return;

          sendNow(pending.messageId);
        }, Math.max(READ_RECEIPT_THROTTLE_MS - elapsed, 0));
      }

      return;
    }

    // If we were waiting to flush a pending update, cancel and send immediately.
    if (throttle.timeoutId != null) {
      window.clearTimeout(throttle.timeoutId);
      throttle.timeoutId = null;
      throttle.pending = null;
    }

    sendNow(last.id);
  }, [conversationId, messages, userId, queryClient, isAtBottom]);
}
