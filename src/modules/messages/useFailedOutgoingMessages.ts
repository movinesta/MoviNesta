import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ConversationMessage, FailedMessagePayload } from "./messageModel";
import { CHAT_MEDIA_BUCKET } from "./chatMedia";
import { conversationMessagesQueryKey } from "./queryKeys";
import type { ConversationMessagesPage } from "./useConversationMessages";
import { removeMessageById } from "./conversationMessagesCache";
import { removeChatMediaFile } from "./chatMediaStorage";
import { isHttpUrl } from "./storageUrls";

export function useFailedOutgoingMessages(args: {
  conversationId: string | null;
  setDraft: (next: string) => void;
  messages: ConversationMessage[] | undefined;
}) {
  const { conversationId, setDraft, messages } = args;
  const queryClient = useQueryClient();

  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedPayload, setLastFailedPayload] = useState<FailedMessagePayload | null>(null);
  const [lastFailedTempId, setLastFailedTempId] = useState<string | null>(null);
  const [failedMessages, setFailedMessages] = useState<Record<string, FailedMessagePayload>>({});

  const failedMessagesRef = useRef<Record<string, FailedMessagePayload>>({});
  useEffect(() => {
    failedMessagesRef.current = failedMessages;
  }, [failedMessages]);

  const prevConversationIdRef = useRef(conversationId);
  useEffect(() => {
    if (conversationId === prevConversationIdRef.current) return;
    prevConversationIdRef.current = conversationId;
    setSendError(null);
    setLastFailedPayload(null);
    setLastFailedTempId(null);
    setFailedMessages({});
    failedMessagesRef.current = {};
  }, [conversationId]);

  // Best-effort cleanup: if we navigate away while there are failed image uploads,
  // those objects would otherwise be orphaned.
  useEffect(() => {
    return () => {
      const payloads = Object.values(failedMessagesRef.current);
      const paths = Array.from(
        new Set(
          payloads
            .map((p) => p.attachmentPath)
            .filter((p): p is string => typeof p === "string" && p.length > 0 && !isHttpUrl(p)),
        ),
      );

      if (paths.length === 0) return;

      void supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .remove(paths)
        .then(({ error }) => {
          if (error) {
            console.error(
              "[useFailedOutgoingMessages] Failed to cleanup orphaned attachments",
              error,
            );
          }
        })
        .catch((err) => {
          console.error("[useFailedOutgoingMessages] Failed to cleanup orphaned attachments", err);
        });
    };
  }, [conversationId]);

  // If messages are removed from the list (e.g. optimistic temp message replaced),
  // drop stale entries from the failed map.
  useEffect(() => {
    if (!messages) return;
    setFailedMessages((prev) => {
      const validIds = new Set(messages.map((m) => m.id));
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!validIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [messages]);

  const clearBannerState = useCallback(() => {
    setSendError(null);
    setLastFailedPayload(null);
    setLastFailedTempId(null);
  }, []);

  const onSendFailed = useCallback(
    (tempId: string, payload: FailedMessagePayload, error: Error) => {
      setSendError(error.message || "Couldn\'t send. Please try again.");
      if (payload.text.trim()) setDraft(payload.text);
      setLastFailedPayload(payload);
      setLastFailedTempId(tempId);
      setFailedMessages((prev) => ({ ...prev, [tempId]: payload }));
    },
    [setDraft],
  );

  const onSendRecovered = useCallback(
    (tempId: string | null) => {
      if (!tempId) return;
      setFailedMessages((prev) => {
        if (!(tempId in prev)) return prev;
        const next = { ...prev };
        delete next[tempId];
        return next;
      });

      if (tempId === lastFailedTempId) {
        clearBannerState();
      }
    },
    [clearBannerState, lastFailedTempId],
  );

  const consumeLastFailedForRetry = useCallback(() => {
    if (!lastFailedPayload) return null;

    const tempId = lastFailedTempId;
    if (tempId) {
      setFailedMessages((prev) => {
        if (!(tempId in prev)) return prev;
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
    }

    clearBannerState();
    return { payload: lastFailedPayload, tempId };
  }, [clearBannerState, lastFailedPayload, lastFailedTempId]);

  const consumeFailedMessageForRetry = useCallback(
    (messageId: string) => {
      const payload = failedMessages[messageId];
      if (!payload) return null;

      setFailedMessages((prev) => {
        if (!(messageId in prev)) return prev;
        const next = { ...prev };
        delete next[messageId];
        return next;
      });

      if (messageId === lastFailedTempId) {
        clearBannerState();
      } else {
        setSendError(null);
      }

      return payload;
    },
    [clearBannerState, failedMessages, lastFailedTempId],
  );

  const discardFailedMessage = useCallback(
    async (messageId: string) => {
      if (!conversationId) return;
      const payload = failedMessages[messageId];
      if (!payload) return;

      // Remove the optimistic message from the cache.
      const messagesKey = conversationMessagesQueryKey(conversationId);
      queryClient.setQueryData<InfiniteData<ConversationMessagesPage>>(messagesKey, (existing) =>
        removeMessageById(existing, messageId),
      );

      setFailedMessages((prev) => {
        if (!(messageId in prev)) return prev;
        const next = { ...prev };
        delete next[messageId];
        return next;
      });

      if (messageId === lastFailedTempId) {
        clearBannerState();
      }

      // Best-effort storage cleanup for orphaned uploads.
      if (payload.attachmentPath) {
        try {
          await removeChatMediaFile(payload.attachmentPath);
        } catch (error) {
          console.error("[useFailedOutgoingMessages] Failed to remove orphaned attachment", error);
        }
      }
    },
    [clearBannerState, conversationId, failedMessages, lastFailedTempId, queryClient],
  );

  return {
    sendError,
    setSendError,
    lastFailedPayload,
    lastFailedTempId,
    failedMessages,
    clearBannerState,
    onSendFailed,
    onSendRecovered,
    consumeLastFailedForRetry,
    consumeFailedMessageForRetry,
    discardFailedMessage,
  };
}
