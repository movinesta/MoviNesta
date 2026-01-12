import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldX } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { usePresence } from "../presence/PresenceProvider";
import type { ConversationListItem, ConversationParticipant } from "./useConversations";
import { useConversations } from "./useConversations";
import { useBlockStatus } from "./useBlockStatus";
import type {
  ConversationMessage,
  MessageDeliveryReceipt,
  ConversationReadReceipt,
  MessageRow as MessageRowType,
} from "./messageModel";
import { getMessageMeta } from "./messageText";
import { useConversationMessages } from "./useConversationMessages";
import { useConversationUiMessages } from "./useConversationUiMessages";
import { useLastVisibleOwnMessageId } from "./useLastVisibleOwnMessageId";
import { useConversationReactions } from "./useConversationReactions";
import {
  useConversationDeliveryReceipts,
  useConversationReadReceipts,
} from "./useConversationReceipts";
import { useTypingChannel } from "./useTypingChannel";
import { useConversationDraft } from "./useConversationDraft";
import { useAttachmentUpload } from "./useAttachmentUpload";
import { useConversationLayoutState } from "./useConversationLayoutState";
import { useConversationMessageActions } from "./useConversationMessageActions";
import { useConversationReadReceiptWriter } from "./useConversationReadReceiptWriter";
import { useSendMessage } from "./useSendMessage";
import { useEditMessage } from "./useEditMessage";
import { useDeleteMessage } from "./useDeleteMessage";
import { useFailedOutgoingMessages } from "./useFailedOutgoingMessages";
import { useConversationInsertedMessageEffects } from "./useConversationInsertedMessageEffects";
import { useConversationUnreadDivider } from "./useConversationUnreadDivider";
import { MessageList } from "./components/MessageList";
import { MessageRow } from "./components/MessageRow";
import { MessageScrollToLatest } from "./components/MessageScrollToLatest";
import { MessageScrollToUnread } from "./components/MessageScrollToUnread";
import { TypingIndicatorInstagram, type TypingUser } from "./components/TypingIndicatorInstagram";
import { ConversationComposerBar } from "./components/ConversationComposerBar";
import { EditMessageDialog } from "./components/EditMessageDialog";
import { DeleteMessageDialog } from "./components/DeleteMessageDialog";
import { ConversationInfoSheet } from "./components/ConversationInfoSheet";
import { MuteOptionsSheet, type MutePreset } from "./components/MuteOptionsSheet";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useConversationSearch } from "./useConversationSearch";
import { useUserLastActive } from "./useUserLastActive";
import { formatTimeAgo } from "./formatTimeAgo";
import { MaterialIcon } from "@/components/ui/material-icon";
import { toast } from "@/components/toasts";
import { saveConversationPrefs } from "./conversationPrefs";
import { useQueryClient } from "@tanstack/react-query";
import { updateConversationListItemInCache } from "./conversationsCache";
import {
  assistantReplyStatusQueryKey,
  conversationMessagesQueryKey,
  conversationsQueryKey,
} from "./queryKeys";
import { safeUpsertMessageRowIntoCache } from "./safeUpsertMessageRow";
import { useAssistantReplyStatus } from "./useAssistantReplyStatus";
import { createRandomTempId } from "./idUtils";
import { createClientId } from "./clientId";
import { supabase } from "@/lib/supabase";
import { useAssistantCache } from "@/lib/useAssistantCache";
import { cn } from "@/lib/utils";
import { usePublicSettings } from "@/providers/PublicSettingsProvider";

// Re-export for modules that import message hooks from this file (e.g. SwipePage.tsx).
// Note: This is intentionally a named export alongside the default export.
export { useSendMessage };

const ConversationPage: React.FC = () => {
  const { conversationId: conversationIdParam } = useParams<{
    conversationId: string;
  }>();
  const conversationId = conversationIdParam ?? null;

  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Dev-only helper to manually verify the cache invalidate+retry path.
  // Usage:
  // - Add ?mn_debug_cache_upsert_fail_once=1 to the URL (dev builds only), OR
  // - localStorage.setItem('mn_debug_cache_upsert_fail_once', '1')
  // The next assistant message insert will intentionally fail once, then recover.
  const debugForceCacheUpsertFailOnceRef = useRef(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("mn_debug_cache_upsert_fail_once");
      const lsKey = "mn_debug_cache_upsert_fail_once";
      const ls = window.localStorage?.getItem(lsKey);
      if (q === "1" || ls === "1") {
        debugForceCacheUpsertFailOnceRef.current = true;
        window.localStorage?.removeItem(lsKey);
      }
    } catch {
      // ignore
    }
  }, []);

  const safeUpsertMessageRow = useCallback(
    (row: MessageRowType | null | undefined, opts?: { allowAppend?: boolean }) => {
      if (!conversationId) return true;
      const key = conversationMessagesQueryKey(conversationId);
      const forceFailOnce = debugForceCacheUpsertFailOnceRef.current;
      if (forceFailOnce) debugForceCacheUpsertFailOnceRef.current = false;
      return safeUpsertMessageRowIntoCache(queryClient as any, key as any, row as any, {
        allowAppend: opts?.allowAppend ?? true,
        forceFailOnce,
        isMountedRef,
      });
    },
    [conversationId, queryClient],
  );

  const { getString, getNumber } = usePublicSettings();
  const assistantUsernameLower = useMemo(
    () => getString("ux.assistant.username", "movinesta").toLowerCase(),
    [getString],
  );
  const presenceLabelOnline = useMemo(
    () => getString("ux.presence.label_online", "Online"),
    [getString],
  );
  const presenceLabelActiveRecently = useMemo(
    () => getString("ux.presence.label_active_recently", "Active recently"),
    [getString],
  );
  const presenceLabelActivePrefix = useMemo(
    () => getString("ux.presence.label_active_prefix", "Active"),
    [getString],
  );
  const messageSearchMinChars = useMemo(() => {
    const raw = getNumber("ux.messages.search.min_query_chars", 2);
    const n = Number.isFinite(raw) ? Math.trunc(raw) : 2;
    return Math.max(1, Math.min(10, n));
  }, [getNumber]);

  const { data: conversations, isLoading: isConversationsLoading } = useConversations();

  const currentUserId = user?.id ?? null;
  const assistantCache = useAssistantCache();

  const conversation: ConversationListItem | null = useMemo(() => {
    if (!conversationId || !conversations) return null;
    return conversations.find((c) => c.id === conversationId) ?? null;
  }, [conversationId, conversations]);

  const isMuted = conversation?.isMuted ?? false;

  const [muteOptionsOpen, setMuteOptionsOpen] = useState(false);

  const unmuteConversation = useCallback(() => {
    if (!conversationId) return;
    if (!currentUserId) {
      toast.error("Please sign in to manage messages.");
      return;
    }

    const prevMuted = conversation?.isMuted ?? false;
    const prevUntil = conversation?.mutedUntil ?? null;
    const hidden = conversation?.isHidden ?? false;

    updateConversationListItemInCache(queryClient, currentUserId, conversationId, (c) => ({
      ...c,
      isMuted: false,
      mutedUntil: null,
    }));

    toast.show("Unmuted notifications.");

    saveConversationPrefs(currentUserId, conversationId, {
      muted: false,
      hidden,
      mutedUntil: null,
    }).then(({ ok }) => {
      if (ok) return;
      updateConversationListItemInCache(queryClient, currentUserId, conversationId, (c) => ({
        ...c,
        isMuted: prevMuted,
        mutedUntil: prevUntil,
      }));
      toast.error("Couldn't update preferences.");
    });
  }, [conversationId, currentUserId, conversation, queryClient]);

  const applyMutePreset = useCallback(
    (preset: MutePreset) => {
      if (!conversationId) return;
      if (!currentUserId) {
        toast.error("Please sign in to manage messages.");
        return;
      }

      const prevMuted = conversation?.isMuted ?? false;
      const prevUntil = conversation?.mutedUntil ?? null;
      const hidden = conversation?.isHidden ?? false;

      let nextMuted = false;
      let nextUntil: string | null = null;

      if (preset.kind === "indefinite") {
        nextMuted = true;
        nextUntil = null;
      } else {
        nextMuted = false;
        nextUntil = new Date(Date.now() + preset.minutes * 60_000).toISOString();
      }

      updateConversationListItemInCache(queryClient, currentUserId, conversationId, (c) => ({
        ...c,
        isMuted: true,
        mutedUntil: nextUntil,
      }));

      toast.show(`Muted notifications for ${preset.label}.`);

      saveConversationPrefs(currentUserId, conversationId, {
        muted: nextMuted,
        hidden,
        mutedUntil: nextUntil,
      }).then(({ ok }) => {
        if (ok) return;
        updateConversationListItemInCache(queryClient, currentUserId, conversationId, (c) => ({
          ...c,
          isMuted: prevMuted,
          mutedUntil: prevUntil,
        }));
        toast.error("Couldn't update preferences.");
      });
    },
    [conversationId, currentUserId, conversation, queryClient],
  );

  const handleMuteClick = useCallback(() => {
    if (isMuted) {
      unmuteConversation();
      return;
    }
    setMuteOptionsOpen(true);
  }, [isMuted, unmuteConversation]);

  const handleInsertedMessage = useConversationInsertedMessageEffects({
    currentUserId: user?.id ?? null,
  });

  const {
    data: messages,
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    error: messagesError,
    loadOlder,
    hasMore: hasMoreMessages,
    isLoadingOlder: isLoadingOlderMessages,
    pollWhenRealtimeDown,
  } = useConversationMessages(conversationId, { onInsert: handleInsertedMessage });

  // If Postgres realtime isn't delivering change events (common when replication isn't enabled),
  // we still want delivery receipts (and inbox previews) to work when messages arrive via polling.
  // This effect runs handleInsertedMessage for messages appended since the last run.
  const lastProcessedMessageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0) return;

    const previousIds = lastProcessedMessageIdsRef.current;
    const nextIds = new Set(messages.map((m) => m.id));

    for (const message of messages) {
      if (!previousIds.has(message.id)) {
        handleInsertedMessage(message);
      }
    }

    lastProcessedMessageIdsRef.current = nextIds;
  }, [conversationId, messages, handleInsertedMessage]);

  const { draft, setDraft } = useConversationDraft({
    conversationId,
    hydrate: () => {
      // Resize after hydration.
      queueMicrotask(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
      });
    },
  });

  const {
    sendError,
    lastFailedPayload,
    failedMessages,
    clearBannerState: clearFailedBannerState,
    onSendFailed,
    onSendRecovered,
    consumeLastFailedForRetry,
    consumeFailedMessageForRetry,
    discardFailedMessage,
  } = useFailedOutgoingMessages({
    conversationId,
    setDraft: (next) => setDraft(next),
    messages,
  });

  const isGroupConversation = conversation?.isGroup ?? false;

  const { getStatus: getPresenceStatus } = usePresence();

  const otherParticipant: ConversationParticipant | null = useMemo(() => {
    if (!conversation) return null;
    const others = conversation.participants.filter((p) => !p.isSelf);
    if (others.length > 0) return others[0];
    if (conversation.participants.length === 1) {
      return conversation.participants[0];
    }
    return null;
  }, [conversation]);

  const otherPresenceStatus = useMemo(() => {
    if (isGroupConversation) return null;
    if (!otherParticipant?.id) return null;
    return getPresenceStatus(otherParticipant.id);
  }, [getPresenceStatus, isGroupConversation, otherParticipant?.id]);

  // For "Last active" when the other user is offline.
  const otherLastActive = useUserLastActive(
    !isGroupConversation ? (otherParticipant?.id ?? null) : null,
  );
  const otherLastActiveLabel = useMemo(() => {
    const iso = otherLastActive.data ?? null;
    const label = formatTimeAgo(iso);
    if (!label) return null;
    if (label === "Just now") return "now";
    return label;
  }, [otherLastActive.data]);

  const isAssistantThread = useMemo(() => {
    // Strongest signal: conversationId matches the cached assistant DM.
    if (assistantCache?.conversationId && conversationId === assistantCache.conversationId) {
      return true;
    }

    // Fallback heuristics for first-run (no cache yet).
    const p = otherParticipant;
    if (!p) return false;
    return p.username?.toLowerCase() === assistantUsernameLower;
  }, [assistantCache?.conversationId, conversationId, otherParticipant, assistantUsernameLower]);

  const assistantReplyStatusQuery = useAssistantReplyStatus(conversationId, isAssistantThread);
  const assistantReplyStatus = assistantReplyStatusQuery.data ?? null;

  // Local in-flight indicator for immediate "optimistic" typing.
  const [assistantInvokeInFlight, setAssistantInvokeInFlight] = useState(false);
  const [assistantStreamText, setAssistantStreamText] = useState<string | null>(null);
  const assistantStreamAbortRef = useRef<AbortController | null>(null);
  const assistantStreamBufferRef = useRef("");
  const assistantStreamFlushRef = useRef<number | null>(null);

  const [assistantStreamMeta, setAssistantStreamMeta] = useState<{
    messageId?: string | null;
    citations?: Array<{ url: string; title?: string; domain?: string }> | null;
  } | null>(null);

  const assistantInvokeState = React.useRef<{ inFlight: boolean; queuedMessageId: string | null }>({
    inFlight: false,
    queuedMessageId: null,
  });

  const assistantDebounceRef = useRef<number | null>(null);
  const assistantDebouncedMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (assistantStreamAbortRef.current) {
        assistantStreamAbortRef.current.abort();
        assistantStreamAbortRef.current = null;
      }
      if (assistantDebounceRef.current) {
        window.clearTimeout(assistantDebounceRef.current);
        assistantDebounceRef.current = null;
      }
      assistantDebouncedMessageIdRef.current = null;
    };
  }, []);

  const [assistantReplyFailed, setAssistantReplyFailed] = useState<{
    userMessageId: string;
    error: string;
  } | null>(null);

  const triggerAssistantReply = useCallback(
    async (userMessageId: string) => {
      if (!conversationId || !currentUserId) return;

      // Coalesce rapid-fire sends: only one in-flight call; queue the latest messageId.
      if (assistantInvokeState.current.inFlight) {
        assistantInvokeState.current.queuedMessageId = userMessageId;
        return;
      }

      assistantInvokeState.current.inFlight = true;
      assistantInvokeState.current.queuedMessageId = null;

      setAssistantInvokeInFlight(true);
      setAssistantReplyFailed(null);

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey =
          import.meta.env.VITE_SUPABASE_ANON_KEY ??
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error("Missing Supabase config for assistant streaming.");
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token ?? null;

        const baseHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        };
        if (accessToken) baseHeaders.Authorization = `Bearer ${accessToken}`;

        const readErrorPayload = async (res: Response) => {
          const raw = await res.text();
          if (!raw) {
            return { message: `Assistant failed (${res.status})`, code: null };
          }
          try {
            const parsed = JSON.parse(raw);
            return {
              message:
                (parsed as any)?.message ??
                (parsed as any)?.error ??
                (parsed as any)?.details ??
                raw,
              code:
                (parsed as any)?.code ??
                (parsed as any)?.errorCode ??
                (parsed as any)?.error_code ??
                null,
            };
          } catch {
            return { message: raw, code: null };
          }
        };

        const shouldFallbackToJson = (
          status: number,
          err: { message?: string | null; code?: string | null },
        ) => {
          if (status === 415) return true;
          const needle = `${err.code ?? ""} ${err.message ?? ""}`.toLowerCase();
          return needle.includes("stream") && needle.includes("support");
        };

        const requestAssistant = async (stream: boolean) => {
          const headers = {
            ...baseHeaders,
            Accept: stream ? "text/event-stream" : "application/json",
          };
          const controller = new AbortController();
          if (stream) assistantStreamAbortRef.current = controller;

          const res = await fetch(`${supabaseUrl}/functions/v1/assistant-chat-reply`, {
            method: "POST",
            headers,
            body: JSON.stringify({ conversationId, userMessageId, stream }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const err = await readErrorPayload(res);
            if (stream && shouldFallbackToJson(res.status, err)) {
              return { fallback: true } as const;
            }
            throw new Error(err.message ?? `Assistant failed (${res.status})`);
          }

          const contentType = res.headers.get("Content-Type") ?? "";
          if (!stream || !contentType.includes("text/event-stream") || !res.body) {
            setAssistantStreamText(null);
            setAssistantStreamMeta(null);
            let payload: any = null;
            try {
              payload = await res.json();
            } catch {
              payload = null;
            }
            if (payload && payload.ok === false) {
              throw new Error(payload.message ?? payload.error ?? "Assistant failed");
            }
            try {
              const messageRow = (payload as any)?.messageRow;
              const inserted = safeUpsertMessageRow(messageRow as any, { allowAppend: true });
              if (!inserted) {
                // If the function only returned a messageId or cache insertion failed, refetch soon.
                const mid =
                  typeof (payload as any)?.messageId === "string"
                    ? (payload as any).messageId
                    : null;
                if (mid) {
                  const key = conversationMessagesQueryKey(conversationId);
                  queryClient.invalidateQueries({ queryKey: key });
                }
              }
            } catch {
              // ignore
            }
            return { fallback: false } as const;
          }

          setAssistantStreamText("");
          assistantStreamBufferRef.current = "";
          setAssistantStreamMeta(null);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let eventName = "message";
          let dataLines: string[] = [];

          const handleEvent = (event: string, data: string) => {
            if (event === "delta") {
              try {
                const parsed = JSON.parse(data);
                const text = typeof parsed?.text === "string" ? parsed.text : "";
                if (text) {
                  assistantStreamBufferRef.current += text;
                  if (assistantStreamFlushRef.current === null) {
                    assistantStreamFlushRef.current = requestAnimationFrame(() => {
                      const buffered = assistantStreamBufferRef.current;
                      assistantStreamBufferRef.current = "";
                      assistantStreamFlushRef.current = null;
                      if (buffered) {
                        setAssistantStreamText((prev) => `${prev ?? ""}${buffered}`);
                      }
                    });
                  }
                }
              } catch {
                // ignore malformed chunk
              }
            }
            if (event === "done") {
              if (assistantStreamFlushRef.current !== null) {
                cancelAnimationFrame(assistantStreamFlushRef.current);
                assistantStreamFlushRef.current = null;
              }
              if (assistantStreamBufferRef.current) {
                const buffered = assistantStreamBufferRef.current;
                assistantStreamBufferRef.current = "";
                setAssistantStreamText((prev) => `${prev ?? ""}${buffered}`);
              }
              try {
                const parsed = JSON.parse(data);
                const citations = Array.isArray((parsed as any)?.citations)
                  ? ((parsed as any).citations as any[]).slice(0, 8)
                  : null;

                const messageRow = (parsed as any)?.messageRow;
                const messageId =
                  typeof (messageRow as any)?.id === "string"
                    ? (messageRow as any).id
                    : typeof (parsed as any)?.messageId === "string"
                      ? (parsed as any).messageId
                      : null;
                if (messageId || citations) {
                  setAssistantStreamMeta({
                    messageId,
                    citations: citations ? (citations as any) : null,
                  });
                }
                if (
                  messageRow &&
                  typeof messageRow === "object" &&
                  typeof (messageRow as any).id === "string"
                ) {
                  const inserted = safeUpsertMessageRow(messageRow as any, { allowAppend: true });
                  if (inserted) {
                    // Stream bubble is no longer needed once we've inserted the saved message.
                    setAssistantStreamText(null);
                    return;
                  }
                  // Cache insertion failed; fall back to showing the stream bubble until a refetch sees the saved row.
                  try {
                    const key = conversationMessagesQueryKey(conversationId);
                    queryClient.invalidateQueries({ queryKey: key });
                  } catch {
                    // ignore
                  }
                }
              } catch {
                setAssistantStreamMeta(null);
              }
            }
            if (event === "error") {
              try {
                const parsed = JSON.parse(data);
                throw new Error(parsed?.message ?? "Assistant failed");
              } catch {
                throw new Error("Assistant failed");
              }
            }
          };

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, idx).replace(/\r$/, "");
              buffer = buffer.slice(idx + 1);
              if (!line.trim()) {
                if (dataLines.length) {
                  handleEvent(eventName, dataLines.join("\n"));
                  dataLines = [];
                  eventName = "message";
                }
                continue;
              }
              if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
                continue;
              }
              if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trimStart());
              }
            }
          }

          return { fallback: false } as const;
        };

        const streamResult = await requestAssistant(true);
        if (streamResult.fallback) {
          setAssistantStreamText(null);
          setAssistantStreamMeta(null);
          await requestAssistant(false);
        }
      } catch (e: any) {
        if (assistantStreamFlushRef.current !== null) {
          cancelAnimationFrame(assistantStreamFlushRef.current);
          assistantStreamFlushRef.current = null;
        }
        assistantStreamBufferRef.current = "";
        setAssistantStreamText(null);
        setAssistantStreamMeta(null);
        setAssistantReplyFailed({ userMessageId, error: e?.message || "Assistant failed" });
      } finally {
        setAssistantInvokeInFlight(false);
        assistantStreamAbortRef.current = null;

        // Ensure UI refresh picks up the assistant reply (or any retries).
        queryClient.invalidateQueries({ queryKey: conversationMessagesQueryKey(conversationId) });
        queryClient.invalidateQueries({ queryKey: conversationsQueryKey(currentUserId) });
        queryClient.invalidateQueries({ queryKey: assistantReplyStatusQueryKey(conversationId) });

        assistantInvokeState.current.inFlight = false;
        const queued = assistantInvokeState.current.queuedMessageId;
        assistantInvokeState.current.queuedMessageId = null;
        if (queued && queued !== userMessageId) {
          // Fire the newest queued message.
          triggerAssistantReply(queued);
        }
      }
    },
    [conversationId, currentUserId, queryClient],
  );

  const scheduleAssistantReply = useCallback(
    (userMessageId: string) => {
      if (!conversationId || !currentUserId) return;
      if (!isAssistantThread) return;

      assistantDebouncedMessageIdRef.current = userMessageId;

      if (assistantDebounceRef.current) {
        window.clearTimeout(assistantDebounceRef.current);
      }

      assistantDebounceRef.current = window.setTimeout(() => {
        const latest = assistantDebouncedMessageIdRef.current;
        assistantDebouncedMessageIdRef.current = null;
        assistantDebounceRef.current = null;
        if (latest) triggerAssistantReply(latest);
      }, 600);
    },
    [conversationId, currentUserId, isAssistantThread, triggerAssistantReply],
  );

  const handleAssistantAction = useCallback(
    async (messageId: string, actionId: string) => {
      if (!conversationId) return;
      try {
        const { data, error } = await supabase.functions.invoke("assistant-message-action", {
          body: { conversationId, messageId, actionId },
        });

        if (error) throw new Error(error.message || "Action failed");
        if (!data?.ok) throw new Error((data as any)?.error || "Action failed");

        const toastMsg = (data as any)?.toast as string | undefined;
        if (toastMsg) toast.success(toastMsg);

        const navigateTo = (data as any)?.navigateTo as string | undefined;
        if (navigateTo) navigate(navigateTo);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg || "Action failed");
      } finally {
        // Refresh so we pick up any assistant follow-up messages or updated state.
        if (conversationId) {
          queryClient.invalidateQueries({ queryKey: conversationMessagesQueryKey(conversationId) });
        }
        if (currentUserId) {
          queryClient.invalidateQueries({ queryKey: conversationsQueryKey(currentUserId) });
        }
      }
    },
    [conversationId, currentUserId, navigate, queryClient],
  );

  const conversationTitle =
    conversation?.title ??
    otherParticipant?.displayName ??
    otherParticipant?.username ??
    "Conversation";

  const sendMessage = useSendMessage(conversationId, {
    onFailed: onSendFailed,
    onRecovered: onSendRecovered,
    otherUserId: !isGroupConversation ? (otherParticipant?.id ?? null) : null,
  });

  type SendAttemptPayload = {
    text: string;
    attachmentPath: string | null;
    attachmentKind?: import("./attachmentUtils").AttachmentKind | null;
    clientId?: string;
  };

  const attemptSend = useCallback(
    (payload: SendAttemptPayload, opts?: { tempId?: string }) => {
      // Clear global error banner before re-attempting.
      clearFailedBannerState();

      sendMessage.mutate(
        {
          text: payload.text,
          attachmentPath: payload.attachmentPath,
          attachmentKind: payload.attachmentKind ?? null,
          clientId: payload.clientId,
          tempId: opts?.tempId,
        },
        {
          onSuccess: async (sentMessage) => {
            clearFailedBannerState();

            // If this is the assistant DM, ask the edge function to generate a reply.
            if (
              isAssistantThread &&
              conversationId &&
              currentUserId &&
              (payload.text.trim().length > 0 || payload.attachmentPath)
            ) {
              scheduleAssistantReply(sentMessage.id);
            }
          },
        },
      );
    },
    [
      clearFailedBannerState,
      conversationId,
      currentUserId,
      isAssistantThread,
      scheduleAssistantReply,
      sendMessage,
    ],
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchDidJumpRef = useRef(false);

  const participantsById = useMemo(() => {
    const map = new Map<string, ConversationParticipant>();
    if (!conversation) return map;
    for (const participant of conversation.participants) {
      map.set(participant.id, participant);
    }
    return map;
  }, [conversation]);

  const { youBlocked, blockedYou, isBlocked, block, unblock } = useBlockStatus(
    !isGroupConversation ? (otherParticipant?.id ?? null) : null,
  );

  // currentUserId defined near the top.

  const {
    imageInputRef,
    attachmentInputRef,
    isUploadingAttachment,
    pendingAttachment,
    uploadError,
    clearPendingAttachment,
    cancelAttachmentUpload,
    clearUploadError,
    handleImageSelected,
    handleAttachmentSelected,
    sendAttachmentFile,
    openImagePicker: handleCameraClick,
    openAttachmentPicker,
  } = useAttachmentUpload({
    conversationId,
    userId: currentUserId,
    isBlocked,
    blockedYou,
    attemptSend,
  });

  const showComposer = !isBlocked && !blockedYou;

  const canToggleBlock = Boolean(otherParticipant) && !isGroupConversation;
  const blockPending = block.isPending || unblock.isPending;
  const [infoOpen, setInfoOpen] = useState(false);

  const handleBlockToggle = useCallback(() => {
    if (!canToggleBlock) return;
    if (youBlocked) {
      unblock.mutate();
      return;
    }
    if (!blockedYou) {
      block.mutate();
    }
  }, [block, blockedYou, canToggleBlock, unblock, youBlocked]);

  const blockAction = canToggleBlock
    ? {
        icon: ShieldX,
        label: youBlocked ? "Unblock" : blockedYou ? "Blocked" : "Block",
        onClick: () => {
          if (youBlocked) {
            unblock.mutate();
          } else if (!blockedYou) {
            block.mutate();
          }
        },
        disabled: blockPending || isConversationsLoading || (blockedYou && !youBlocked),
      }
    : null;

  const {
    headerRef,
    headerHeight,
    composerHeight,
    isAtBottom,
    setIsAtBottom,
    handleComposerHeightChange,
    showEmojiPicker,
    setShowEmojiPicker,
  } = useConversationLayoutState({ showComposer });
  const [hasMeasuredAtBottom, setHasMeasuredAtBottom] = useState(false);

  // Reserve space so the last message stays visible above the fixed composer.
  // We apply this as bottom padding on the scroll container.
  const reservedBottomPx = showComposer ? Math.max(composerHeight, 0) + 24 : 40;
  const messageListBottomPadding = `${reservedBottomPx}px`;

  // Consider the user "at bottom" (pinned) when within the reserved spacer, plus a
  // small slack for layout jitter.
  const pinnedThresholdPx = Math.max(80, reservedBottomPx + 32);

  const selfDisplayName = useMemo(() => {
    return conversation?.participants.find((p) => p.isSelf)?.displayName ?? "You";
  }, [conversation]);

  const { remoteTypingUsers, noteLocalInputActivity, stopTyping } = useTypingChannel({
    conversationId,
    userId: user?.id ?? null,
    displayName: selfDisplayName,
  });

  const { data: readReceipts } = useConversationReadReceipts(conversationId);

  useConversationReadReceiptWriter({
    conversationId,
    userId: user?.id ?? null,
    isAtBottom: isAtBottom === true && hasMeasuredAtBottom,
    messages,
  });

  const { reactionsByMessageId, toggleReaction } = useConversationReactions(conversationId);

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      toggleReaction.mutate({ messageId, emoji });
    },
    [toggleReaction],
  );
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const lastSeenLastMessageIdRef = useRef<string | null>(null);

  const pendingScrollToMessageIdRef = useRef<string | null>(null);
  const pendingAutoScrollRef = useRef(false);
  const didInitialScrollRef = useRef(false);
  const isJumpingToUnreadRef = useRef(false);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const scrollerElRef = useRef<HTMLDivElement | null>(null);
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const messageNodeByIdRef = useRef(new Map<string, HTMLDivElement>());
  const scrollerRef = useCallback((node: HTMLDivElement | null) => {
    scrollerElRef.current = node;
    setScrollerEl(node);
  }, []);
  const isProgrammaticScrollRef = useRef(false);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const isPinnedToBottomRef = useRef(true);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    isPinnedToBottomRef.current = isPinnedToBottom;
  }, [isPinnedToBottom]);

  const {
    activeActionMessageId,
    openMessageActions,
    closeMessageActions,
    hiddenMessageIds,
    hideMessageForMe,
    deleteDialog,
    openDeleteDialog,
    closeDeleteDialog,
    editingMessage,
    openEditDialog,
    updateEditingText,
    closeEditDialog,
    editTextareaRef,
    editError,
    setEditError,
  } = useConversationMessageActions({
    conversationId,
    currentUserId,
    showComposer,
    isBlocked,
    blockedYou,
    composerTextareaRef: textareaRef,
  });

  // Only show "seen" indicator on the very last *visible* outgoing message (not on every message).
  // If the user hides their most recent outgoing message "for me", we prefer showing status on the
  // last visible outgoing message instead.
  const lastOwnMessageId = useLastVisibleOwnMessageId({
    messages,
    currentUserId,
    hiddenMessageIds,
  });

  // Perf: delivery receipts can be very large in active conversations. We only need receipts
  // for the message(s) that can actually display delivery status. Today, that's the last
  // visible outgoing message.
  const lastOwnMessageIds = useMemo(
    () => (lastOwnMessageId ? [lastOwnMessageId] : []),
    [lastOwnMessageId],
  );

  const { data: deliveryReceipts } = useConversationDeliveryReceipts(
    conversationId,
    lastOwnMessageIds,
  );

  const editMessageMutation = useEditMessage(conversationId);
  const deleteMessageMutation = useDeleteMessage(conversationId);

  const { visibleMessages } = useConversationUiMessages({
    messages,
    conversation,
    currentUserId,
    participantsById,
    reactionsByMessageId,
    hiddenMessageIds,
    deliveryReceipts: (deliveryReceipts ?? []) as unknown as MessageDeliveryReceipt[],
    readReceipts: (readReceipts ?? []) as unknown as ConversationReadReceipt[],
    failedMessages,
    lastOwnMessageId,
  });

  useEffect(() => {
    const mid = assistantStreamMeta?.messageId ?? null;
    if (!mid) return;

    const found = (messages ?? []).some((m: any) => String((m as any)?.id ?? "") === String(mid));
    if (found) {
      setAssistantStreamText(null);
      setAssistantStreamMeta(null);
      return;
    }

    // Safety: if the DB refresh is slow or fails, avoid leaving the streaming bubble stuck forever.
    const timer = window.setTimeout(() => {
      setAssistantStreamText(null);
      setAssistantStreamMeta(null);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [assistantStreamMeta?.messageId, messages]);

  const streamingAssistantMessage = useMemo(() => {
    if (!assistantStreamText) return null;
    if (!conversationId || !otherParticipant?.id) return null;
    const message: ConversationMessage = {
      id: `assistant_stream_${conversationId}`,
      conversationId,
      senderId: otherParticipant.id,
      createdAt: new Date().toISOString(),
      body: { type: "text", text: assistantStreamText },
      attachmentUrl: null,
      text: assistantStreamText,
    };

    const citations = Array.isArray(assistantStreamMeta?.citations)
      ? assistantStreamMeta?.citations
      : null;
    if (citations && citations.length) {
      (message as any).meta = { ai: { ui: { citations } } };
    }

    return {
      message,
      meta: { ...getMessageMeta(message.body), streaming: true },
      sender: otherParticipant,
      isSelf: false,
      deliveryStatus: null,
      showDeliveryStatus: false,
      reactions: [],
    };
  }, [assistantStreamText, assistantStreamMeta, conversationId, otherParticipant]);

  const {
    firstUnreadIndex,
    lastReadMessageId,
    hasUnread,
    isReady: unreadReady,
  } = useConversationUnreadDivider({
    conversationId,
    userId: user?.id ?? null,
    conversation,
    readReceipts,
    visibleMessages,
  });

  const unreadFromOthersCount = useMemo(() => {
    if (!unreadReady) return 0;
    if (!hasUnread) return 0;

    let startIndex = firstUnreadIndex;

    // If we couldn't compute the first unread index from the visible window, fall back to
    // using the last read message (if we have it) to estimate where "unread" starts.
    if (startIndex == null) {
      if (typeof lastReadMessageId === "string" && lastReadMessageId) {
        const found = visibleMessages.findIndex((m) => m.message.id === lastReadMessageId);
        startIndex = found >= 0 ? found + 1 : null;
      }
    }

    if (startIndex == null) return 0;

    return visibleMessages.slice(startIndex).filter((item) => !item.isSelf && !item.meta.deleted)
      .length;
  }, [firstUnreadIndex, hasUnread, lastReadMessageId, unreadReady, visibleMessages]);

  const hasVisibleMessages = visibleMessages.length > 0;
  const visibleMessagesRef = useRef(visibleMessages);
  const hasMoreMessagesRef = useRef(hasMoreMessages);
  const streamingScrollFrameRef = useRef<number | null>(null);
  const streamingPinnedRef = useRef(false);
  const streamingActiveRef = useRef(false);
  const streamingAutoScrollActiveRef = useRef(false);

  const displayMessages = useMemo(() => {
    if (!streamingAssistantMessage) return visibleMessages;
    const streamedMessageId = assistantStreamMeta?.messageId ?? null;
    if (
      streamedMessageId &&
      visibleMessages.some((item) => item.message.id === streamedMessageId)
    ) {
      return visibleMessages;
    }
    return [...visibleMessages, streamingAssistantMessage];
  }, [assistantStreamMeta?.messageId, streamingAssistantMessage, visibleMessages]);

  const scrollBehavior: "auto" | "smooth" = prefersReducedMotion ? "auto" : "smooth";

  // Single, non-jittery scroll helper.
  // We intentionally avoid multi-retry loops because they fight Virtuoso's built-in `followOutput`
  // and cause "jumpy" behavior when new items arrive.
  const scrollToBottom = useCallback(
    (behaviorOverride?: "auto" | "smooth") => {
      const el = scrollerElRef.current;
      if (!el) return;

      isProgrammaticScrollRef.current = true;
      requestAnimationFrame(() => {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: (behaviorOverride ?? scrollBehavior) as ScrollBehavior,
        });
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
      });
    },
    [scrollBehavior],
  );

  const requestAutoScrollToBottom = useCallback(() => {
    pendingAutoScrollRef.current = true;
    setIsPinnedToBottom(true);
    setIsAtBottom(true);
    setHasMeasuredAtBottom(true);
    scrollToBottom("auto");
  }, [scrollToBottom, setIsAtBottom]);

  const scrollToMessageId = useCallback(
    (messageId: string, opts?: { align?: ScrollLogicalPosition; behavior?: "auto" | "smooth" }) => {
      const node = messageNodeByIdRef.current.get(messageId);
      if (!node) return false;

      isProgrammaticScrollRef.current = true;
      requestAnimationFrame(() => {
        node.scrollIntoView({
          block: opts?.align ?? "end",
          behavior: (opts?.behavior ?? scrollBehavior) as ScrollBehavior,
        });
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
      });

      return true;
    },
    [scrollBehavior],
  );

  useEffect(() => {
    visibleMessagesRef.current = visibleMessages;
  }, [visibleMessages]);

  // NOTE: Do not force-scroll when messages are appended.
  // Virtuoso's `followOutput` handles "stay pinned to bottom" when the user is at bottom.

  useEffect(() => {
    hasMoreMessagesRef.current = hasMoreMessages;
  }, [hasMoreMessages]);

  const prependRestoreRef = useRef<{
    active: boolean;
    prevScrollHeight: number;
    prevScrollTop: number;
    prevCount: number;
  } | null>(null);

  const beginPrependRestore = useCallback(() => {
    const el = scrollerElRef.current;
    if (!el) return;
    prependRestoreRef.current = {
      active: true,
      prevScrollHeight: el.scrollHeight,
      prevScrollTop: el.scrollTop,
      prevCount: visibleMessagesRef.current.length,
    };
  }, []);

  // Preserve scroll position when older messages are prepended.
  React.useLayoutEffect(() => {
    const state = prependRestoreRef.current;
    const el = scrollerElRef.current;
    if (!state?.active || !el) return;
    if (visibleMessages.length <= state.prevCount) return;

    const nextHeight = el.scrollHeight;
    const delta = nextHeight - state.prevScrollHeight;
    el.scrollTop = state.prevScrollTop + delta;

    prependRestoreRef.current = null;
  }, [visibleMessages.length]);

  // One-time initial positioning: the message list should open at the latest message
  // (instead of starting at the top) so new messages are immediately visible and
  // auto-scroll can lock in correctly.
  useEffect(() => {
    didInitialScrollRef.current = false;
    lastSeenLastMessageIdRef.current = null;
    setPendingNewCount(0);
  }, [conversationId]);

  useEffect(() => {
    if (didInitialScrollRef.current) return;
    if (!hasVisibleMessages) return;
    if (!scrollerElRef.current) return;

    const lastIndex = visibleMessages.length - 1;
    if (lastIndex < 0) return;

    // Mark as positioned now to avoid duplicate scheduling while waiting for the frame.
    didInitialScrollRef.current = true;

    // Wait a frame for Virtuoso to mount/measure before scrolling.
    requestAnimationFrame(() => {
      scrollToBottom("auto");

      // Treat the initial positioning as "measured at bottom" so followOutput can work immediately.
      // Otherwise, incoming realtime messages won't auto-follow until the user manually scrolls.
      setHasMeasuredAtBottom(true);
      setIsAtBottom(true);
      setIsPinnedToBottom(true);

      lastSeenLastMessageIdRef.current = visibleMessages[lastIndex]?.message.id ?? null;
      setPendingNewCount(0);
    });
  }, [
    conversationId,
    hasVisibleMessages,
    scrollToBottom,
    scrollerEl,
    setIsAtBottom,
    visibleMessages,
  ]);
  // After sending a message, scroll to the optimistic temp message once it appears.
  // This avoids racing the cache update and eliminates "scroll didn't happen" flakiness.
  useEffect(() => {
    const targetId = pendingScrollToMessageIdRef.current;
    if (!targetId) return;

    const inList = visibleMessages.some((m) => m.message.id === targetId);
    if (!inList) {
      pendingScrollToMessageIdRef.current = null;
      return;
    }

    const didScroll = scrollToMessageId(targetId, { align: "end", behavior: "auto" });
    if (didScroll) {
      pendingScrollToMessageIdRef.current = null;
    }
  }, [scrollToMessageId, visibleMessages]);

  // Auto-follow new messages only when the user is already pinned near the bottom.
  const lastVisibleMessageId =
    visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1]!.message.id : null;

  useEffect(() => {
    if (!lastVisibleMessageId) return;
    if (!pendingAutoScrollRef.current) return;

    pendingAutoScrollRef.current = false;
    scrollToBottom("auto");
  }, [lastVisibleMessageId, scrollToBottom]);

  useEffect(() => {
    if (!lastVisibleMessageId) return;
    if (!didInitialScrollRef.current) return;
    if (!isPinnedToBottomRef.current) return;
    if (prependRestoreRef.current?.active) return;
    // If we just sent a message, the pending scroll handler will handle it.
    if (pendingScrollToMessageIdRef.current) return;

    scrollToBottom(scrollBehavior);
  }, [lastVisibleMessageId, scrollBehavior, scrollToBottom]);

  useEffect(() => {
    const isStreaming = assistantStreamText !== null;
    if (isStreaming && !streamingActiveRef.current) {
      streamingPinnedRef.current = isPinnedToBottomRef.current;
    }
    if (!isStreaming && streamingActiveRef.current) {
      streamingPinnedRef.current = false;
    }
    streamingActiveRef.current = isStreaming;
  }, [assistantStreamText]);

  React.useLayoutEffect(() => {
    if (!assistantStreamText) return;
    if (!streamingPinnedRef.current) return;

    streamingAutoScrollActiveRef.current = true;

    const tick = () => {
      if (!streamingAutoScrollActiveRef.current) return;
      scrollToBottom("auto");
      streamingScrollFrameRef.current = requestAnimationFrame(tick);
    };

    if (streamingScrollFrameRef.current !== null) {
      cancelAnimationFrame(streamingScrollFrameRef.current);
    }
    streamingScrollFrameRef.current = requestAnimationFrame(tick);

    return () => {
      streamingAutoScrollActiveRef.current = false;
      if (streamingScrollFrameRef.current !== null) {
        cancelAnimationFrame(streamingScrollFrameRef.current);
        streamingScrollFrameRef.current = null;
      }
    };
  }, [assistantStreamText, scrollToBottom]);

  // Keep a reliable "pinned to bottom" signal based on the actual scroll container.
  // Virtuoso's internal atBottom can be thrown off by a fixed composer + reserved padding.
  useEffect(() => {
    if (!scrollerEl) return;

    const computePinned = () => {
      const dist = scrollerEl.scrollHeight - scrollerEl.scrollTop - scrollerEl.clientHeight;
      const pinned = dist <= pinnedThresholdPx;
      setIsPinnedToBottom((prev) => (prev === pinned ? prev : pinned));
      setIsAtBottom((prev) => (prev === pinned ? prev : pinned));
      setHasMeasuredAtBottom(true);
    };

    computePinned();

    const onScroll = () => {
      computePinned();
      if (!isProgrammaticScrollRef.current) {
        didInitialScrollRef.current = true;
        isJumpingToUnreadRef.current = false;
      }
    };

    scrollerEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollerEl.removeEventListener("scroll", onScroll);
  }, [scrollerEl, pinnedThresholdPx, setIsAtBottom]);

  useEffect(() => {
    const lastMessageId = visibleMessages.length
      ? (visibleMessages[visibleMessages.length - 1]?.message.id ?? null)
      : null;

    if (isAtBottom === true) {
      lastSeenLastMessageIdRef.current = lastMessageId;
      setPendingNewCount(0);
      return;
    }

    if (!lastMessageId) return;

    const lastSeen = lastSeenLastMessageIdRef.current;
    if (lastSeen === lastMessageId) return;

    const lastSeenIndex = lastSeen
      ? visibleMessages.findIndex((m) => m.message.id === lastSeen)
      : -1;
    if (lastSeen && lastSeenIndex < 0) {
      lastSeenLastMessageIdRef.current = lastMessageId;
      setPendingNewCount(0);
      return;
    }

    const unseen = visibleMessages.slice(Math.max(0, lastSeenIndex + 1));
    const newCount = unseen.filter((item) => !item.isSelf).length;

    if (newCount <= 0) return;

    setPendingNewCount(newCount);
  }, [isAtBottom, visibleMessages]);

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current != null) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  // Escape handling is declared later (after search is created), so it can close
  // message actions, emoji picker, and conversation search consistently.

  // NOTE: handleSendText is declared later (after handleJumpToLatest) to avoid
  // temporal dead-zone issues from referencing handleJumpToLatest before it's initialized.

  const handleRetrySend = () => {
    const retry = consumeLastFailedForRetry();
    if (!retry) return;
    attemptSend(retry.payload, { tempId: retry.tempId ?? undefined });
  };

  // Long-tap handling: delay opening actions, and make sure click after long-press
  // does NOT instantly close the menu (fixes "appear then vanish" glitch).
  const handleBubbleTouchStart = (message: ConversationMessage) => {
    if (longPressTimeoutRef.current != null) {
      window.clearTimeout(longPressTimeoutRef.current);
    }
    longPressTriggeredRef.current = false;
    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      openMessageActions(message);
    }, 500);
  };

  const handleBubbleTouchEndOrCancel = () => {
    if (longPressTimeoutRef.current != null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleRetryMessage = useCallback(
    (message: ConversationMessage) => {
      const payload = consumeFailedMessageForRetry(message.id);
      if (!payload) return;
      attemptSend(payload, { tempId: message.id });
    },
    [attemptSend, consumeFailedMessageForRetry],
  );

  const handleDiscardFailedMessage = useCallback(
    (message: ConversationMessage) => {
      void discardFailedMessage(message.id);
    },
    [discardFailedMessage],
  );

  const scrollToUiIndex = useCallback(
    (uiIndex: number) => {
      if (uiIndex < 0) return;
      const id = visibleMessagesRef.current[uiIndex]?.message.id ?? null;
      if (!id) return;
      scrollToMessageId(id, { align: "center" });
    },
    [scrollToMessageId],
  );

  const search = useConversationSearch({
    items: visibleMessages,
    onJumpToItemIndex: (uiIndex) => {
      searchDidJumpRef.current = true;
      scrollToUiIndex(uiIndex);
    },
    minQueryLen: messageSearchMinChars,
  });

  const searchQueryActive = search.query.trim().length >= messageSearchMinChars;

  useEffect(() => {
    // Reset search state when switching conversations.
    search.close();
  }, [conversationId, search.close]);

  const openSearch = () => {
    closeMessageActions();
    setShowEmojiPicker(false);
    search.setIsOpen(true);
    queueMicrotask(() => searchInputRef.current?.focus());
  };

  const closeSearch = () => {
    search.close();
  };

  useEffect(() => {
    const handleGlobalEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      // Prefer closing conversation search first.
      if (search.isOpen) {
        event.preventDefault();
        closeSearch();
        return;
      }

      closeMessageActions();
      setShowEmojiPicker(false);
    };

    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, [closeMessageActions, closeSearch, search.isOpen, setShowEmojiPicker]);

  useEffect(() => {
    // Reset "did jump" when the query changes so Enter jumps to the first match again.
    searchDidJumpRef.current = false;
  }, [search.query]);

  const handleJumpToLatest = useCallback(
    (behaviorOverride?: "auto" | "smooth") => {
      const lastIndex = visibleMessages.length - 1;
      if (lastIndex < 0) return;

      const lastMessageId = visibleMessages[lastIndex]?.message.id ?? null;
      if (lastMessageId) {
        lastSeenLastMessageIdRef.current = lastMessageId;
      }

      setPendingNewCount(0);

      // Scroll to bottom. Virtuoso + followOutput handle the rest.
      scrollToBottom(behaviorOverride ?? scrollBehavior);

      // After a brief delay (to allow the scroll), return focus to the composer so
      // keyboard users can resume typing immediately.
      window.setTimeout(
        () => {
          textareaRef.current?.focus();
        },
        prefersReducedMotion ? 0 : 200,
      );
    },
    [scrollBehavior, prefersReducedMotion, visibleMessages, scrollToBottom],
  );

  const handleComposerResize = useCallback(
    (height: number) => {
      handleComposerHeightChange(height);
      if (isAtBottom === true) {
        scrollToBottom("auto");
      }
    },
    [handleComposerHeightChange, isAtBottom, scrollToBottom],
  );

  const handleJumpToUnread = useCallback(
    async (behaviorOverride?: "auto" | "smooth") => {
      if (!hasUnread) return;
      if (isJumpingToUnreadRef.current) return;
      isJumpingToUnreadRef.current = true;

      try {
        let targetIndex = firstUnreadIndex;

        if (targetIndex == null && typeof lastReadMessageId === "string" && lastReadMessageId) {
          let attempts = 0;
          while (hasMoreMessagesRef.current && attempts < 8) {
            const foundIndex = visibleMessagesRef.current.findIndex(
              (m) => m.message.id === lastReadMessageId,
            );
            if (foundIndex >= 0) {
              targetIndex = foundIndex + 1;
              break;
            }
            await loadOlder();
            attempts += 1;
          }
        }

        if (targetIndex == null) return;

        const targetId = visibleMessagesRef.current[targetIndex]?.message.id ?? null;

        if (targetId) {
          scrollToMessageId(targetId, {
            align: "start",
            behavior: behaviorOverride ?? scrollBehavior,
          });
        }

        window.setTimeout(
          () => {
            textareaRef.current?.focus();
          },
          prefersReducedMotion ? 0 : 150,
        );
      } finally {
        isJumpingToUnreadRef.current = false;
      }
    },
    [
      firstUnreadIndex,
      hasUnread,
      unreadReady,
      lastReadMessageId,
      loadOlder,
      prefersReducedMotion,
      scrollBehavior,
    ],
  );

  const handleSendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      clearFailedBannerState();

      // Once the user interacts (send), never allow an "initial scroll" effect to reposition them.
      didInitialScrollRef.current = true;
      isJumpingToUnreadRef.current = false;

      pendingAutoScrollRef.current = true;

      const tempId = createRandomTempId();
      const clientId = createClientId();

      // Treat sending as an explicit intent to be pinned to the latest.
      setIsPinnedToBottom(true);
      setIsAtBottom(true);
      setHasMeasuredAtBottom(true);

      // Scroll to the optimistic temp message as soon as it appears.
      pendingScrollToMessageIdRef.current = tempId;

      attemptSend({ text: text.trim(), attachmentPath: null, clientId }, { tempId });
    },
    [attemptSend, clearFailedBannerState, setIsAtBottom],
  );

  useEffect(() => {
    lastSeenLastMessageIdRef.current = null;
    setPendingNewCount(0);
  }, [conversationId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Search within conversation: Ctrl/Cmd+F
      if (event.key.toLowerCase() === "f" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openSearch();
        return;
      }

      // Jump to latest: End, Meta+ArrowDown, or Ctrl+End
      if (
        event.key === "End" ||
        (event.key === "ArrowDown" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "End" && (event.metaKey || event.ctrlKey))
      ) {
        event.preventDefault();
        handleJumpToLatest();
        return;
      }

      // Jump to first unread: Alt+U
      if (event.key.toLowerCase() === "u" && event.altKey) {
        event.preventDefault();
        handleJumpToUnread();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleJumpToLatest, handleJumpToUnread, openSearch]);

  const headerSubtitle = useMemo(() => {
    if (blockedYou) return "You are blocked";
    if (isBlocked) return "You blocked them";

    if (isAssistantThread) {
      if (assistantStreamText !== null) return "Streaming…";
      if (
        assistantInvokeInFlight ||
        assistantReplyStatus?.is_typing ||
        assistantReplyStatus?.is_queued
      ) {
        return "Typing…";
      }
    }

    // Instagram-style: show typing state under the name.
    if (remoteTypingUsers.length > 0) {
      if (isGroupConversation) {
        if (remoteTypingUsers.length === 1) {
          const t = remoteTypingUsers[0];
          return `${t.displayName ?? "Someone"} typing…`;
        }
        return `${remoteTypingUsers.length} typing…`;
      }
      return "Typing…";
    }

    if (!isGroupConversation && otherPresenceStatus) {
      if (otherPresenceStatus === "online") return presenceLabelOnline;
      if (otherPresenceStatus === "away") return presenceLabelActiveRecently;
    }

    if (!isGroupConversation && otherLastActiveLabel) {
      return otherLastActiveLabel === "now"
        ? presenceLabelOnline
        : `${presenceLabelActivePrefix} ${otherLastActiveLabel}`;
    }

    return conversation?.subtitle || (isGroupConversation ? "Group chat" : "Direct message");
  }, [
    blockedYou,
    isBlocked,
    isAssistantThread,
    assistantInvokeInFlight,
    assistantReplyStatus?.is_typing,
    assistantReplyStatus?.is_queued,
    assistantStreamText,
    isGroupConversation,
    otherPresenceStatus,
    otherLastActiveLabel,
    conversation?.subtitle,
    remoteTypingUsers,
    presenceLabelOnline,
    presenceLabelActiveRecently,
    presenceLabelActivePrefix,
  ]);

  const typingIndicatorUsers: TypingUser[] = useMemo(() => {
    const participants = conversation?.participants ?? [];
    const byId = new Map(participants.map((p) => [p.id, p] as const));
    const out: TypingUser[] = [];

    for (const t of remoteTypingUsers) {
      const p = byId.get(t.userId);
      const displayName = p?.displayName ?? t.displayName ?? "Someone";
      out.push({
        id: t.userId,
        displayName,
        avatarUrl: p?.avatarUrl ?? null,
      });
    }

    // Assistant DMs: show the assistant typing bubble while a reply is queued or processing.
    const showAssistantTyping =
      isAssistantThread &&
      otherParticipant?.id &&
      (assistantInvokeInFlight ||
        assistantReplyStatus?.is_typing ||
        assistantReplyStatus?.is_queued) &&
      assistantStreamText === null;

    if (showAssistantTyping) {
      const already = out.some((u) => u.id === otherParticipant.id);
      if (!already) {
        out.unshift({
          id: otherParticipant.id,
          displayName:
            otherParticipant.displayName ??
            otherParticipant.username ??
            conversationTitle ??
            "Assistant",
          avatarUrl: otherParticipant.avatarUrl ?? null,
        });
      }
    }

    return out;
  }, [
    assistantInvokeInFlight,
    assistantStreamText,
    assistantReplyStatus?.is_typing,
    assistantReplyStatus?.is_queued,
    conversation?.participants,
    conversationTitle,
    isAssistantThread,
    otherParticipant,
    remoteTypingUsers,
  ]);
  if (!conversationId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-border bg-card px-5 py-6 text-center text-sm text-foreground">
          <h1 className="text-base font-heading font-semibold">Conversation not found</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            This page is meant to be opened from your messages list.
          </p>
          <p className="mt-4">
            <Link
              to="/messages"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground"
            >
              Back to messages
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-page relative flex h-[100dvh] w-full flex-col items-stretch overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-1 min-h-0 flex-col items-stretch rounded-none border border-border bg-background sm:rounded-2xl">
        <div
          ref={headerRef}
          className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md"
        >
          <header className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Go back"
              >
                <MaterialIcon name="arrow_back" />
              </button>
              <div className="relative">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                  {otherParticipant?.avatarUrl ? (
                    <img
                      src={otherParticipant.avatarUrl}
                      alt={otherParticipant.displayName ?? "Conversation"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-foreground/80">
                      {(otherParticipant?.displayName ?? conversationTitle)
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
                {!isGroupConversation &&
                  (otherPresenceStatus === "online" || otherLastActiveLabel === "now") && (
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                        "bg-green-500",
                      )}
                      title="Online"
                    />
                  )}
              </div>
              <div className="flex flex-col">
                <h1 className="text-base font-bold leading-none text-foreground">
                  {conversationTitle}
                </h1>
                <p className="mt-1 text-xs font-medium text-primary">{headerSubtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Search in conversation"
                onClick={() => {
                  if (search.isOpen) closeSearch();
                  else openSearch();
                }}
              >
                <MaterialIcon name="search" />
              </button>
              <button
                type="button"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Video call"
                onClick={() => toast.show("Video calls are coming soon.")}
              >
                <MaterialIcon name="videocam" />
              </button>
              <button
                type="button"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Conversation info"
                onClick={() => setInfoOpen(true)}
              >
                <MaterialIcon name="info" />
              </button>
              {blockAction ? (
                <button
                  type="button"
                  onClick={blockAction.onClick}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  aria-label={blockAction.label}
                >
                  <ShieldX className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </header>

          {search.isOpen && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MaterialIcon name="search" className="text-muted-foreground" />
                  </div>
                  <input
                    ref={searchInputRef}
                    value={search.query}
                    onChange={(e) => search.setQuery(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (!searchQueryActive || search.matchCount === 0) return;

                        if (event.shiftKey) {
                          searchDidJumpRef.current = true;
                          search.jumpPrev();
                          return;
                        }

                        if (!searchDidJumpRef.current) {
                          search.jumpToFirst();
                          searchDidJumpRef.current = true;
                          return;
                        }

                        search.jumpNext();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        closeSearch();
                      }
                    }}
                    placeholder="Search messages..."
                    className="block w-full rounded-full border border-input bg-background py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {search.query.trim() && (
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition hover:text-foreground"
                      aria-label="Clear search"
                      onClick={() => {
                        search.clear();
                        queueMicrotask(() => searchInputRef.current?.focus());
                      }}
                    >
                      <MaterialIcon name="close" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
                    aria-label="Previous match"
                    disabled={!searchQueryActive || search.matchCount === 0}
                    onClick={() => {
                      searchDidJumpRef.current = true;
                      search.jumpPrev();
                    }}
                  >
                    <MaterialIcon name="keyboard_arrow_up" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
                    aria-label="Next match"
                    disabled={!searchQueryActive || search.matchCount === 0}
                    onClick={() => {
                      searchDidJumpRef.current = true;
                      search.jumpNext();
                    }}
                  >
                    <MaterialIcon name="keyboard_arrow_down" />
                  </button>

                  <div className="min-w-[56px] text-right text-xs font-medium text-muted-foreground">
                    {searchQueryActive ? `${search.activeMatchNumber}/${search.matchCount}` : "0/0"}
                  </div>

                  <button
                    type="button"
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    aria-label="Close search"
                    onClick={closeSearch}
                  >
                    <MaterialIcon name="close" />
                  </button>
                </div>
              </div>

              {searchQueryActive && search.matchCount === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">No matches found.</p>
              )}
            </div>
          )}
        </div>

        {/* Body + input */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            {pollWhenRealtimeDown && (
              <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-4">
                <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-[12px] text-amber-800 shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  <span>Live updates slowed — polling for changes</span>
                </div>
              </div>
            )}
            <MessageList
              items={displayMessages}
              isLoading={isMessagesLoading && !hasVisibleMessages}
              loadingContent={
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Loading messages…</span>
                </div>
              }
              errorContent={
                isMessagesError ? (
                  <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                    <p className="font-medium text-red-100">
                      We couldn&apos;t load this conversation.
                    </p>
                    {messagesError instanceof Error && (
                      <p className="mt-1 text-xs text-red-200/70">{messagesError.message}</p>
                    )}
                  </div>
                ) : undefined
              }
              emptyContent={
                !hasVisibleMessages ? (
                  <div className="text-center text-[12px] text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {isGroupConversation ? "No messages in this group yet." : "No messages yet."}
                    </p>
                    <p className="mt-1">
                      {isGroupConversation
                        ? "Be the first to start the conversation."
                        : "Say hi to start the conversation."}
                    </p>
                  </div>
                ) : undefined
              }
              footer={
                <>
                  <TypingIndicatorInstagram users={typingIndicatorUsers} />
                  <div className="h-1" aria-hidden />
                </>
              }
              header={
                hasMoreMessages ? (
                  <div className="flex items-center justify-center pb-2 text-xs text-muted-foreground">
                    {isLoadingOlderMessages ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Loading older messages…
                      </span>
                    ) : (
                      <span>Scroll up to load older messages</span>
                    )}
                  </div>
                ) : null
              }
              bottomPadding={messageListBottomPadding}
              scrollerRef={scrollerRef}
              onStartReached={() => {
                if (hasMoreMessages && !isLoadingOlderMessages) {
                  beginPrependRestore();
                  void loadOlder();
                }
              }}
              computeItemKey={(_, item) => item.message.id}
              itemContent={(index, uiMessage) => {
                const {
                  message,
                  meta,
                  sender,
                  isSelf,
                  deliveryStatus,
                  reactions,
                  showDeliveryStatus,
                } = uiMessage;

                const previous = index > 0 ? (displayMessages[index - 1]?.message ?? null) : null;
                const next =
                  index < displayMessages.length - 1
                    ? (displayMessages[index + 1]?.message ?? null)
                    : null;

                const registerNode = (node: HTMLDivElement | null) => {
                  const map = messageNodeByIdRef.current;
                  if (node) map.set(message.id, node);
                  else map.delete(message.id);
                };

                return (
                  <div ref={registerNode} data-message-id={message.id}>
                    <MessageRow
                      message={message}
                      meta={meta}
                      sender={sender}
                      isSelf={isSelf}
                      deliveryStatus={deliveryStatus}
                      showDeliveryStatus={showDeliveryStatus}
                      reactions={reactions}
                      index={index}
                      previousMessage={previous}
                      nextMessage={next}
                      firstUnreadIndex={firstUnreadIndex}
                      activeActionMessageId={activeActionMessageId}
                      longPressTriggeredRef={longPressTriggeredRef}
                      onOpenMessageActions={openMessageActions}
                      onCloseMessageActions={closeMessageActions}
                      onOpenEditDialog={openEditDialog}
                      onOpenDeleteDialog={openDeleteDialog}
                      onToggleReaction={handleToggleReaction}
                      onRetryMessage={handleRetryMessage}
                      onDiscardFailedMessage={handleDiscardFailedMessage}
                      onAssistantAction={handleAssistantAction}
                      onBubbleTouchStart={handleBubbleTouchStart}
                      onBubbleTouchEndOrCancel={handleBubbleTouchEndOrCancel}
                      searchQuery={searchQueryActive ? search.query : undefined}
                      isSearchMatch={searchQueryActive ? search.isMatch(message.id) : false}
                      isActiveSearchMatch={
                        searchQueryActive ? search.activeMessageId === message.id : false
                      }
                    />
                  </div>
                );
              }}
            />

            <MessageScrollToUnread
              show={Boolean(hasUnread && unreadFromOthersCount > 0 && isAtBottom !== true)}
              unreadCount={unreadFromOthersCount}
              onClick={handleJumpToUnread}
              shortcutHint="Alt+U"
            />

            <MessageScrollToLatest
              show={isAtBottom !== true && pendingNewCount > 0}
              pendingCount={pendingNewCount}
              onClick={handleJumpToLatest}
              shortcutHint={
                typeof navigator !== "undefined" && navigator.platform?.includes("Mac")
                  ? "⌘+↓"
                  : "End"
              }
            />
          </div>

          {assistantReplyFailed && isAssistantThread && showComposer && (
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between gap-2 rounded-xl border bg-background/95 p-2 shadow-sm">
                <div className="flex items-start gap-2">
                  <MaterialIcon
                    name="error"
                    className="mt-0.5 text-destructive"
                    ariaLabel="Error"
                  />
                  <div>
                    <div className="text-xs font-semibold leading-snug">
                      Assistant didn&apos;t reply
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug">
                      {assistantReplyFailed.error}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold hover:bg-muted"
                    onClick={() => {
                      const msgId = assistantReplyFailed.userMessageId;
                      setAssistantReplyFailed(null);
                      triggerAssistantReply(msgId);
                    }}
                  >
                    <MaterialIcon name="refresh" className="text-base" />
                    Retry
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    onClick={() => setAssistantReplyFailed(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <ConversationComposerBar
            show={showComposer}
            headerHeight={headerHeight}
            onHeightChange={handleComposerResize}
            typingUsers={remoteTypingUsers}
            isGroupConversation={isGroupConversation}
            draft={draft}
            setDraft={setDraft}
            textareaRef={textareaRef}
            noteLocalInputActivity={noteLocalInputActivity}
            stopTyping={stopTyping}
            onSendText={handleSendText}
            onRequestScrollToBottom={requestAutoScrollToBottom}
            isUploadingAttachment={isUploadingAttachment}
            pendingAttachment={pendingAttachment}
            clearPendingAttachment={clearPendingAttachment}
            cancelAttachmentUpload={cancelAttachmentUpload}
            sendError={Boolean(sendError)}
            sendErrorMessage={sendError}
            canRetrySend={Boolean(lastFailedPayload)}
            onRetrySend={handleRetrySend}
            uploadError={uploadError}
            clearUploadError={clearUploadError}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            openCameraPicker={handleCameraClick}
            openAttachmentPicker={openAttachmentPicker}
            imageInputRef={imageInputRef as React.RefObject<HTMLInputElement>}
            attachmentInputRef={attachmentInputRef as React.RefObject<HTMLInputElement>}
            onImageSelected={(event) => {
              requestAutoScrollToBottom();
              handleImageSelected(event);
            }}
            onAttachmentSelected={(event) => {
              requestAutoScrollToBottom();
              handleAttachmentSelected(event);
            }}
            onAttachmentFile={(file) => sendAttachmentFile(file)}
            disableSend={Boolean(isBlocked || blockedYou)}
          />

          {blockedYou && (
            <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-border bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground">
              <p>You can&apos;t send messages because this user has blocked you.</p>
            </div>
          )}

          {isBlocked && !blockedYou && (
            <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-border bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground">
              <p>You&apos;ve blocked this user. Unblock them to continue the conversation.</p>
            </div>
          )}
        </section>
      </div>

      <EditMessageDialog
        open={Boolean(editingMessage)}
        editingMessage={editingMessage}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
        onCancel={closeEditDialog}
        onTextChange={updateEditingText}
        textareaRef={editTextareaRef as React.RefObject<HTMLTextAreaElement>}
        error={editError}
        isSaving={editMessageMutation.isPending}
        onSave={() => {
          if (!editingMessage) return;
          const text = editingMessage.text.trim();
          if (!text) return;

          setEditError(null);
          editMessageMutation.mutate(
            {
              messageId: editingMessage.messageId,
              text,
              currentBody: editingMessage.body,
              attachmentUrl: editingMessage.attachmentUrl,
            },
            {
              onSuccess: () => {
                closeEditDialog();
              },
              onError: () => {
                setEditError("Couldn't save changes. Please try again.");
              },
            },
          );
        }}
      />

      <DeleteMessageDialog
        open={Boolean(deleteDialog)}
        deleteDialog={deleteDialog}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
        onHideForMe={() => {
          if (!deleteDialog) return;
          hideMessageForMe(deleteDialog.messageId);
          closeDeleteDialog();
        }}
        onDeleteForEveryone={() => {
          if (!deleteDialog) return;
          deleteMessageMutation.mutate(
            { messageId: deleteDialog.messageId, attachmentUrl: deleteDialog.attachmentUrl },
            {
              onSettled: () => {
                closeDeleteDialog();
              },
            },
          );
        }}
        isDeleting={deleteMessageMutation.isPending}
      />

      {conversationId && (
        <ConversationInfoSheet
          open={infoOpen}
          onOpenChange={setInfoOpen}
          conversation={conversation}
          currentUserId={currentUserId}
          conversationId={conversationId}
          isMuted={isMuted}
          onToggleMute={handleMuteClick}
          otherParticipant={otherParticipant}
          isGroupConversation={isGroupConversation}
          youBlocked={youBlocked}
          blockedYou={blockedYou}
          blockPending={blockPending}
          onBlockToggle={handleBlockToggle}
        />
      )}

      {conversationId && (
        <MuteOptionsSheet
          open={muteOptionsOpen}
          onOpenChange={setMuteOptionsOpen}
          conversationTitle={conversationTitle}
          onSelect={(preset) => applyMutePreset(preset)}
        />
      )}
    </div>
  );
};

export default ConversationPage;
