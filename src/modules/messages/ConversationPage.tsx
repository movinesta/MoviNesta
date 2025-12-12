import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCheck,
  Edit3,
  Loader2,
  Send,
  Smile,
  Trash2,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import type { ConversationListItem, ConversationParticipant } from "./useConversations";
import { useConversations } from "./useConversations";
import { getMessageMeta, parseMessageText } from "./messageText";
import { fetchBlockStatus, useBlockStatus } from "./useBlockStatus";
import {
  ConversationMessage,
  ConversationReadReceipt,
  FailedMessagePayload,
  MessageDeliveryReceipt,
  MessageDeliveryStatus,
  ReactionSummary,
  isSameCalendarDate,
  formatMessageDateLabel,
  formatMessageTime,
  isWithinGroupingWindow,
} from "./messageModel";
import { useConversationMessages } from "./useConversationMessages";
import { useConversationReactions } from "./useConversationReactions";
import { ConversationHeader } from "./components/ConversationHeader";
import { MessageList } from "./components/MessageList";
import { MessageBubble } from "./components/MessageBubble";
import { MessageComposer } from "./components/MessageComposer";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UiMessage {
  message: ConversationMessage;
  meta: ReturnType<typeof getMessageMeta>;
  sender: ConversationParticipant | null;
  isSelf: boolean;
  deliveryStatus: MessageDeliveryStatus | null;
  showDeliveryStatus: boolean;
  reactions: ReactionSummary[];
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "😍"];

const CHAT_MEDIA_BUCKET = "chat-media";

const buildAttachmentPath = (conversationId: string, userId: string, fileName: string) => {
  const ext = fileName.split(".").pop() ?? "jpg";
  const randomId =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now();
  return `message_attachments/${conversationId}/${userId}/${Date.now()}-${randomId}.${ext}`;
};

const buildMessagePayload = (text: string, attachmentPath: string | null) => {
  const trimmed = text.trim();

  if (!attachmentPath && !trimmed) {
    return { payload: null, trimmed } as const;
  }

  if (attachmentPath && trimmed) {
    return { payload: { type: "text+image", text: trimmed }, trimmed } as const;
  }

  if (attachmentPath) {
    return { payload: { type: "image", text: "" }, trimmed } as const;
  }

  return { payload: { type: "text", text: trimmed }, trimmed } as const;
};

const useConversationReadReceipts = (conversationId: string | null) => {
  return useQuery<ConversationReadReceipt[]>({
    queryKey: ["conversation", conversationId, "readReceipts"],
    enabled: Boolean(conversationId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: conversationId ? 12000 : false,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<ConversationReadReceipt[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("message_read_receipts")
        .select("user_id, conversation_id, last_read_at, last_read_message_id")
        .eq("conversation_id", conversationId)
        .order("last_read_at", { ascending: false });

      if (error) {
        console.error("[ConversationPage] Failed to load read receipts", error);
        throw new Error(error.message);
      }

      return (data ?? []).map((row) => ({
        userId: row.user_id,
        lastReadAt: row.last_read_at ?? null,
        lastReadMessageId: row.last_read_message_id ?? null,
      }));
    },
  });
};

const useConversationDeliveryReceipts = (conversationId: string | null) => {
  return useQuery<MessageDeliveryReceipt[]>({
    queryKey: ["conversation", conversationId, "deliveryReceipts"],
    enabled: Boolean(conversationId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: conversationId ? 15000 : false,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<MessageDeliveryReceipt[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("message_delivery_receipts")
        .select("id, conversation_id, message_id, user_id, delivered_at, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[ConversationPage] Failed to load delivery receipts", error);
        throw new Error(error.message);
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        messageId: row.message_id,
        userId: row.user_id,
        deliveredAt: row.delivered_at ?? row.created_at,
      }));
    },
  });
};

interface SendMessageArgs {
  text: string;
  attachmentPath?: string | null;
}

export const useSendMessage = (
  conversationId: string | null,
  options?: {
    onFailed?: (tempId: string, payload: FailedMessagePayload) => void;
    onRecovered?: (tempId: string | null) => void;
    otherUserId?: string | null;
  },
) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ text, attachmentPath }: SendMessageArgs) => {
      if (!conversationId) throw new Error("Missing conversation id.");
      if (!userId) throw new Error("You must be signed in to send messages.");

      if (options?.otherUserId) {
        const status = await fetchBlockStatus(supabase, userId, options.otherUserId);

        if (status.youBlocked) {
          throw new Error("You have blocked this user. Unblock them to send messages.");
        }

        if (status.blockedYou) {
          throw new Error("You cannot send messages because this user blocked you.");
        }
      }

      const { payload } = buildMessagePayload(text, attachmentPath ?? null);
      if (!payload) {
        throw new Error("Cannot send an empty message.");
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          body: JSON.stringify(payload),
          attachment_url: attachmentPath ?? null,
        })
        .select("id, conversation_id, user_id, body, attachment_url, created_at")
        .single();

      if (error) {
        console.error("[ConversationPage] Failed to send message", error);
        throw new Error(error.message);
      }

      const row: ConversationMessage = {
        id: data.id as string,
        conversationId: data.conversation_id as string,
        senderId: data.user_id as string,
        body: (data.body as string | null) ?? null,
        attachmentUrl: (data.attachment_url as string | null) ?? null,
        createdAt: data.created_at as string,
      };

      try {
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      } catch (err) {
        console.error("[ConversationPage] Failed to update conversation timestamp", err);
      }

      return row;
    },
    onMutate: async ({ text, attachmentPath }) => {
      if (!conversationId || !userId) return { previousMessages: undefined, tempId: null };

      const { payload, trimmed } = buildMessagePayload(text, attachmentPath ?? null);
      if (!payload) {
        throw new Error("Cannot send an empty message.");
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();

      const optimistic: ConversationMessage = {
        id: tempId,
        conversationId,
        senderId: userId,
        body: JSON.stringify(payload),
        attachmentUrl: attachmentPath ?? null,
        createdAt,
      };

      await queryClient.cancelQueries({
        queryKey: ["conversation", conversationId, "messages"],
      });
      const previousMessages = queryClient.getQueryData<ConversationMessage[]>([
        "conversation",
        conversationId,
        "messages",
      ]);

      queryClient.setQueryData<ConversationMessage[]>(
        ["conversation", conversationId, "messages"],
        (existing) => {
          const current = existing ?? [];
          const next = [...current, optimistic];
          next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return next;
        },
      );

      return {
        previousMessages,
        tempId,
        optimistic,
        payload: { text: trimmed, attachmentPath: attachmentPath ?? null },
      };
    },
    onError: (error, _variables, context) => {
      console.error("[ConversationPage] sendMessage error", error);
      if (conversationId) {
        const { previousMessages, optimistic, payload, tempId } = context ?? {};
        const base =
          previousMessages ??
          queryClient.getQueryData<ConversationMessage[]>([
            "conversation",
            conversationId,
            "messages",
          ]) ??
          [];

        const next = optimistic ? [...base, optimistic] : [...base];
        next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        queryClient.setQueryData(["conversation", conversationId, "messages"], next);

        if (tempId && payload && options?.onFailed) {
          options.onFailed(tempId, payload);
        }
      }
    },
    onSuccess: (row, _variables, context) => {
      if (!conversationId) return;
      const tempId = context?.tempId;

      queryClient.setQueryData<ConversationMessage[]>(
        ["conversation", conversationId, "messages"],
        (existing) => {
          const current = existing ?? [];
          const withoutTemp = tempId
            ? current.filter((m) => m.id !== tempId)
            : current.filter((m) => m.id !== row.id);
          const alreadyIdx = withoutTemp.findIndex((m) => m.id === row.id);
          if (alreadyIdx >= 0) {
            const copy = [...withoutTemp];
            copy[alreadyIdx] = row;
            return copy;
          }
          const next = [...withoutTemp, row];
          next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return next;
        },
      );

      queryClient.invalidateQueries({ queryKey: ["conversations"] });

      if (options?.onRecovered) {
        options.onRecovered(context?.tempId ?? null);
      }
    },
  });
};

const useEditMessage = (conversationId: string | null) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, text }: { messageId: string; text: string }) => {
      if (!conversationId) throw new Error("Missing conversation id.");
      if (!userId) throw new Error("You must be signed in to edit messages.");

      const trimmed = text.trim();
      const bodyPayload = {
        type: "text",
        text: trimmed,
        editedAt: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("messages")
        .update({
          body: JSON.stringify(bodyPayload),
        })
        .eq("id", messageId)
        .eq("user_id", userId)
        .select("id, conversation_id, user_id, body, attachment_url, created_at")
        .single();

      if (error) {
        console.error("[ConversationPage] Failed to edit message", error);
        throw new Error(error.message);
      }

      const updated: ConversationMessage = {
        id: data.id as string,
        conversationId: data.conversation_id as string,
        senderId: data.user_id as string,
        body: (data.body as string | null) ?? null,
        attachmentUrl: (data.attachment_url as string | null) ?? null,
        createdAt: data.created_at as string,
      };

      return updated;
    },
    onSuccess: (updated) => {
      if (!conversationId) return;
      const queryKey = ["conversation", conversationId, "messages"];
      queryClient.setQueryData<ConversationMessage[]>(queryKey, (existing) => {
        if (!existing) return [updated];
        return existing.map((m) => (m.id === updated.id ? updated : m));
      });
    },
  });
};

const useDeleteMessage = (conversationId: string | null) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  // Soft delete: mark as deleted instead of removing from DB
  return useMutation({
    mutationFn: async ({ messageId }: { messageId: string }) => {
      if (!conversationId) throw new Error("Missing conversation id.");
      if (!userId) throw new Error("You must be signed in to delete messages.");

      const deletedAt = new Date().toISOString();
      const bodyPayload = {
        type: "system",
        text: "",
        deleted: true,
        deletedAt,
      };

      const { data, error } = await supabase
        .from("messages")
        .update({
          body: JSON.stringify(bodyPayload),
          attachment_url: null,
        })
        .eq("id", messageId)
        .eq("user_id", userId)
        .select("id, conversation_id, user_id, body, attachment_url, created_at")
        .single();

      if (error) {
        console.error("[ConversationPage] Failed to delete message", error);
        throw new Error(error.message);
      }

      const updated: ConversationMessage = {
        id: data.id as string,
        conversationId: data.conversation_id as string,
        senderId: data.user_id as string,
        body: (data.body as string | null) ?? null,
        attachmentUrl: (data.attachment_url as string | null) ?? null,
        createdAt: data.created_at as string,
      };

      return updated;
    },
    onSuccess: (updated) => {
      if (!conversationId) return;
      const queryKey = ["conversation", conversationId, "messages"];
      queryClient.setQueryData<ConversationMessage[]>(queryKey, (existing) => {
        if (!existing) return [updated];
        return existing.map((m) => (m.id === updated.id ? updated : m));
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};

/**
 * Renders an attachment image from chat-media bucket using a signed URL.
 */
export const ChatImage: React.FC<{ path: string }> = ({ path }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(false);

    if (!path) {
      setError(true);
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      const { data, error: err } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrl(path, 60 * 60);

      if (cancelled) return;
      if (err || !data?.signedUrl) {
        console.error("[ChatImage] createSignedUrl error", err);
        setError(true);
        return;
      }
      setUrl(data.signedUrl);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (error) {
    return <div className="mt-1 text-xs text-muted-foreground">Image unavailable.</div>;
  }

  if (!url) {
    return <div className="mt-1 h-32 w-40 animate-pulse rounded-xl bg-border/40" />;
  }

  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-border bg-background/80">
      <img src={url} alt="Attachment" className="max-h-64 w-full object-cover" loading="lazy" />
    </div>
  );
};

const ConversationPage: React.FC = () => {
  const { conversationId: conversationIdParam } = useParams<{
    conversationId: string;
  }>();
  const conversationId = conversationIdParam ?? null;

  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading: isConversationsLoading } = useConversations();
  const {
    data: messages,
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    error: messagesError,
  } = useConversationMessages(conversationId);

  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFailedPayload, setLastFailedPayload] = useState<FailedMessagePayload | null>(null);
  const [failedMessages, setFailedMessages] = useState<Record<string, FailedMessagePayload>>({});

  const handleSendFailed = (tempId: string, payload: FailedMessagePayload) => {
    setSendError("Couldn't send. Please try again.");
    setDraft(payload.text);
    resizeTextarea();
    setLastFailedPayload(payload);
    setFailedMessages((prev) => ({ ...prev, [tempId]: payload }));
  };

  const handleSendRecovered = (tempId: string | null) => {
    if (!tempId) return;
    setFailedMessages((prev) => {
      if (!(tempId in prev)) return prev;
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  };

  const conversation: ConversationListItem | null = useMemo(() => {
    if (!conversationId || !conversations) return null;
    return conversations.find((c) => c.id === conversationId) ?? null;
  }, [conversationId, conversations]);

  const isGroupConversation = conversation?.isGroup ?? false;

  const otherParticipant: ConversationParticipant | null = useMemo(() => {
    if (!conversation) return null;
    const others = conversation.participants.filter((p) => !p.isSelf);
    if (others.length > 0) return others[0];
    if (conversation.participants.length === 1) {
      return conversation.participants[0];
    }
    return null;
  }, [conversation]);

  const sendMessage = useSendMessage(conversationId, {
    onFailed: handleSendFailed,
    onRecovered: handleSendRecovered,
    otherUserId: !isGroupConversation ? (otherParticipant?.id ?? null) : null,
  });
  const [isAtBottom, setIsAtBottom] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const participantsById = useMemo(() => {
    const map = new Map<string, ConversationParticipant>();
    if (!conversation) return map;
    for (const participant of conversation.participants) {
      map.set(participant.id, participant);
    }
    return map;
  }, [conversation]);

  const {
    youBlocked,
    blockedYou,
    isBlocked,
    isLoading: isBlockStatusLoading,
    block,
    unblock,
  } = useBlockStatus(!isGroupConversation ? (otherParticipant?.id ?? null) : null);

  const hasMessages = (messages?.length ?? 0) > 0;
  const isLoading = isConversationsLoading || isMessagesLoading || isBlockStatusLoading;

  const currentUserId = user?.id ?? null;

  // Only show "seen" indicator on the very last outgoing message (not on every message)
  const lastOwnMessageId = useMemo(() => {
    if (!messages || !currentUserId) return null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.senderId === currentUserId) {
        const meta = getMessageMeta(m.body);
        if (!meta.deleted) {
          return m.id;
        }
      }
    }
    return null;
  }, [messages, currentUserId]);

  const [remoteTypingUsers, setRemoteTypingUsers] = useState<string[]>([]);
  const typingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const lastReadRef = useRef<{
    conversationId: string | null;
    messageId: string | null;
    userId: string | null;
  }>({
    conversationId: null,
    messageId: null,
    userId: null,
  });

  const typingStateRef = useRef<{
    isTyping: boolean;
    timeoutId: number | null;
  }>({
    isTyping: false,
    timeoutId: null,
  });

  const { data: readReceipts } = useConversationReadReceipts(conversationId);
  const {
    reactionsByMessageId,
    toggleReaction,
    queryKey: reactionsQueryKey,
  } = useConversationReactions(conversationId);
  const { data: deliveryReceipts } = useConversationDeliveryReceipts(conversationId);
  const editMessageMutation = useEditMessage(conversationId);
  const deleteMessageMutation = useDeleteMessage(conversationId);

  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Record<string, true>>({});
  const [deleteDialog, setDeleteDialog] = useState<{ messageId: string } | null>(null);

  const [editingMessage, setEditingMessage] = useState<{
    messageId: string;
    text: string;
  } | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);

  const [editError, setEditError] = useState<string | null>(null);

  const closeEditDialog = useCallback(() => {
    setEditingMessage(null);
    setEditError(null);
    if (editTriggerRef.current) {
      editTriggerRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!editingMessage) return;

    queueMicrotask(() => {
      editTextareaRef.current?.focus();
    });
  }, [editingMessage]);

  const uiMessages = useMemo<UiMessage[]>(() => {
    if (!messages) return [];

    return messages.map((message) => {
      const meta = getMessageMeta(message.body);
      const sender = participantsById.get(message.senderId) ?? null;
      const isSelf =
        sender?.isSelf ?? (currentUserId != null && message.senderId === currentUserId);
      const deliveryStatus = getMessageDeliveryStatus(
        message,
        conversation ?? null,
        deliveryReceipts,
        readReceipts,
        currentUserId,
        failedMessages,
      );

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

  const hasVisibleMessages = visibleMessages.length > 0;

  useEffect(() => {
    lastReadRef.current = { conversationId: null, messageId: null, userId: null };
  }, [conversationId, user?.id]);

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current != null) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  // Typing indicator channel
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const channel = supabase.channel(`supabase_realtime_typing:conversation:${conversationId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    typingChannelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const data = payload as { userId: string; isTyping: boolean };

        if (!data || data.userId === user.id) return;

        const participant = participantsById.get(data.userId);
        const displayName = participant?.displayName ?? "Someone";
        const key = data.userId;

        const existingTimeoutId = typingTimeoutsRef.current.get(key);
        if (existingTimeoutId != null) {
          window.clearTimeout(existingTimeoutId);
        }

        if (data.isTyping) {
          setRemoteTypingUsers((prev) => {
            if (prev.includes(displayName)) return prev;
            return [...prev, displayName];
          });

          const timeoutId = window.setTimeout(() => {
            typingTimeoutsRef.current.delete(key);
            setRemoteTypingUsers((prev) => prev.filter((name) => name !== displayName));
          }, 4000);

          typingTimeoutsRef.current.set(key, timeoutId);
        } else {
          typingTimeoutsRef.current.delete(key);
          setRemoteTypingUsers((prev) => prev.filter((name) => name !== displayName));
        }
      })
      .subscribe((status) => {
        console.log("[ConversationPage] Typing channel status", status);
      });

    return () => {
      typingTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      typingTimeoutsRef.current.clear();

      if (channel) {
        supabase.removeChannel(channel);
      }
      typingChannelRef.current = null;
    };
  }, [conversationId, user?.id, participantsById]);

  // Realtime: new messages + updates (edits/deletes) + delivery insert on receiver
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`supabase_realtime_messages_publication:conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("[ConversationPage] Realtime message payload", payload);
          const row = payload.new as {
            id: string;
            conversation_id: string;
            user_id: string;
            body: string | null;
            attachment_url: string | null;
            created_at: string;
          };

          if (user?.id && row.user_id === user.id) {
            return;
          }

          const newMessage: ConversationMessage = {
            id: row.id,
            conversationId: row.conversation_id,
            senderId: row.user_id,
            body: row.body,
            attachmentUrl: row.attachment_url,
            createdAt: row.created_at,
          };

          queryClient.setQueryData<ConversationMessage[]>(
            ["conversation", conversationId, "messages"],
            (existing) => {
              const current = existing ?? [];
              const alreadyExists = current.some((m) => m.id === newMessage.id);
              if (alreadyExists) return current;

              const merged = [...current, newMessage];
              merged.sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
              );
              return merged;
            },
          );

          queryClient.invalidateQueries({ queryKey: ["conversations"] });

          // Insert delivery receipt on the receiver client
          if (user?.id && row.user_id !== user.id) {
            supabase
              .from("message_delivery_receipts")
              .insert({
                conversation_id: row.conversation_id,
                message_id: row.id,
                user_id: user.id,
              })
              .then(
                ({ error }) => {
                  if (error) {
                    console.error("[ConversationPage] Failed to insert delivery receipt", error);
                  }
                },
                (err: unknown) => {
                  console.error(
                    "[ConversationPage] Unexpected error inserting delivery receipt",
                    err,
                  );
                },
              );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string;
            user_id: string;
            body: string | null;
            attachment_url: string | null;
            created_at: string;
          };

          const updatedMessage: ConversationMessage = {
            id: row.id,
            conversationId: row.conversation_id,
            senderId: row.user_id,
            body: row.body,
            attachmentUrl: row.attachment_url,
            createdAt: row.created_at,
          };

          queryClient.setQueryData<ConversationMessage[]>(
            ["conversation", conversationId, "messages"],
            (existing) => {
              const current = existing ?? [];
              const idx = current.findIndex((m) => m.id === updatedMessage.id);
              if (idx === -1) return current;
              const copy = [...current];
              copy[idx] = updatedMessage;
              return copy;
            },
          );
        },
      );

    channel.subscribe((status) => {
      console.log("[ConversationPage] Realtime channel status (messages)", status);
      if (status === "CHANNEL_ERROR") {
        console.error("[ConversationPage] Realtime channel error for messages", status);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, user?.id]);

  // Read receipts
  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0 || !user?.id) return;

    const last = messages[messages.length - 1];

    if (
      lastReadRef.current.conversationId === conversationId &&
      lastReadRef.current.messageId === last.id &&
      lastReadRef.current.userId === user.id
    ) {
      return;
    }

    supabase
      .from("message_read_receipts")
      .upsert(
        {
          conversation_id: conversationId,
          user_id: user.id,
          last_read_message_id: last.id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" },
      )
      .then(
        () => {
          lastReadRef.current = {
            conversationId,
            messageId: last.id,
            userId: user.id,
          };
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
        (error: unknown) => {
          console.error("[ConversationPage] Failed to update read receipt", error);
        },
      );
  }, [conversationId, messages, user?.id, queryClient]);

  // Realtime read-receipt updates
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`supabase_realtime_read_receipts:conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_read_receipts",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversation", conversationId, "readReceipts"],
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_read_receipts",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversation", conversationId, "readReceipts"],
          });
        },
      )
      .subscribe((status) => {
        console.log("[ConversationPage] Realtime channel status (read receipts)", status);
        if (status === "CHANNEL_ERROR") {
          console.error("[ConversationPage] Realtime channel error for read receipts", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Realtime reactions
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`supabase_realtime_message_reactions:conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          if (reactionsQueryKey) {
            queryClient.invalidateQueries({ queryKey: reactionsQueryKey });
          }
        },
      )
      .subscribe((status) => {
        console.log("[ConversationPage] Realtime channel status (reactions)", status);
        if (status === "CHANNEL_ERROR") {
          console.error("[ConversationPage] Realtime channel error for reactions", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, reactionsQueryKey]);

  // Realtime delivery receipts
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`supabase_realtime_message_delivery_receipts:conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_delivery_receipts",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversation", conversationId, "deliveryReceipts"],
          });
        },
      )
      .subscribe((status) => {
        console.log("[ConversationPage] Realtime channel status (delivery receipts)", status);
        if (status === "CHANNEL_ERROR") {
          console.error("[ConversationPage] Realtime channel error for delivery receipts", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(140, textarea.scrollHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > nextHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    resizeTextarea();
  }, [draft]);

  const notifyTyping = (nextDraft: string) => {
    const channel = typingChannelRef.current;
    if (!channel || !conversationId || !user) return;

    const trimmed = nextDraft.trim();
    const isNowTyping = trimmed.length > 0;
    const wasTyping = typingStateRef.current.isTyping;

    if (isNowTyping && !wasTyping) {
      typingStateRef.current.isTyping = true;
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: user.id,
          isTyping: true,
        },
      });
    }

    if (typingStateRef.current.timeoutId != null) {
      window.clearTimeout(typingStateRef.current.timeoutId);
    }

    if (isNowTyping) {
      typingStateRef.current.timeoutId = window.setTimeout(() => {
        typingStateRef.current.isTyping = false;
        channel.send({
          type: "broadcast",
          event: "typing",
          payload: {
            userId: user.id,
            isTyping: false,
          },
        });
      }, 3000);
    } else if (!isNowTyping && wasTyping) {
      typingStateRef.current.isTyping = false;
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: user.id,
          isTyping: false,
        },
      });
    }
  };

  const handleDraftChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setDraft(next);
    resizeTextarea();
    if (showEmojiPicker) setShowEmojiPicker(false);
    notifyTyping(next);
  };

  const handleEmojiSelect = (emoji: string) => {
    if (!emoji) return;
    setDraft((prev) => {
      const next = `${prev}${emoji}`;
      resizeTextarea();
      notifyTyping(next);
      return next;
    });
  };

  const attemptSend = (payload: FailedMessagePayload) => {
    sendMessage.mutate(
      { text: payload.text, attachmentPath: payload.attachmentPath },
      {
        onError: (error) => {
          console.error("[ConversationPage] sendMessage mutate error", error);
          setSendError("Couldn't send. Please try again.");
          setDraft(payload.text);
          resizeTextarea();
          setLastFailedPayload(payload);
        },
        onSuccess: () => {
          setSendError(null);
          setLastFailedPayload(null);
        },
      },
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (isBlocked || blockedYou) return;

    const text = draft.trim();
    if (!text) return;

    setDraft("");
    resizeTextarea();
    setSendError(null);
    setLastFailedPayload(null);
    notifyTyping("");

    attemptSend({ text, attachmentPath: null });
  };

  const handleRetrySend = () => {
    if (!lastFailedPayload) return;
    setSendError(null);
    attemptSend(lastFailedPayload);
  };

  const handleCameraClick = () => {
    if (!conversationId || !user?.id) return;
    if (isBlocked || blockedYou) return;

    fileInputRef.current?.click();
  };

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || !conversationId || !user?.id) return;
    if (isUploadingImage) return;
    if (isBlocked || blockedYou) return;

    await handleSendImageFile(file);
  };

  const handleSendImageFile = async (file: File) => {
    if (!conversationId || !user?.id) return;
    if (isBlocked || blockedYou) return;

    setUploadError(null);
    setIsUploadingImage(true);

    try {
      const path = buildAttachmentPath(conversationId, user.id, file.name);

      const { error: uploadErrorResult } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadErrorResult) {
        console.error("[ConversationPage] image upload error", uploadErrorResult);
        setUploadError("Upload failed. Please try another image.");
        return;
      }

      const { error: signedUrlError } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrl(path, 60 * 60);

      if (signedUrlError) {
        console.error("[ConversationPage] signed URL generation failed", signedUrlError);
        setUploadError("Could not generate a secure download link.");
        return;
      }

      attemptSend({ text: "", attachmentPath: path });
    } catch (error) {
      console.error("[ConversationPage] handleSendImageFile failed", error);
      setUploadError("Something went wrong while sending your image.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const openMessageActions = (message: ConversationMessage) => {
    if (isBlocked || blockedYou) return;

    const meta = getMessageMeta(message.body);
    if (meta.deleted) return; // don't open bar for deleted messages

    setActiveActionMessageId(message.id);

    // Blur main input so there's no focus border while interacting with actions
    if (textareaRef.current) {
      textareaRef.current.blur();
    }
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

  const handleRetryMessage = (message: ConversationMessage) => {
    const failedPayload = failedMessages[message.id];
    if (failedPayload) {
      setDraft(failedPayload.text);
      setLastFailedPayload(failedPayload);
    }
  };

  return (
    <div className="conversation-page relative flex min-h-screen w-full flex-col items-stretch bg-background">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-1 min-h-0 flex-col items-stretch rounded-none border border-border bg-background sm:rounded-2xl">
        <ConversationHeader
          conversation={conversation}
          isLoading={isConversationsLoading}
          isGroupConversation={isGroupConversation}
          otherParticipant={otherParticipant ?? undefined}
          onBack={() => navigate("/messages")}
          onToggleBlock={
            !isGroupConversation && otherParticipant
              ? () => {
                  if (youBlocked) {
                    unblock.mutate();
                  } else {
                    block.mutate();
                  }
                }
              : undefined
          }
          blockPending={block.isPending || unblock.isPending}
          youBlocked={youBlocked}
        />

        {/* Body + input */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <MessageList
              items={visibleMessages}
              isLoading={isLoading && !hasMessages}
              loadingContent={
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Loading messages…</span>
                </div>
              }
              errorContent={
                isMessagesError ? (
                  <div className="mb-3 rounded-md border border-border bg-background/90 px-3 py-2 text-[12px] text-destructive">
                    <p className="font-medium">We couldn&apos;t load this conversation.</p>
                    {messagesError instanceof Error && (
                      <p className="mt-1 text-xs text-muted-foreground">{messagesError.message}</p>
                    )}
                  </div>
                ) : undefined
              }
              emptyContent={
                !hasVisibleMessages ? (
                  <div className="text-center text-[12px] text-muted-foreground">
                    <p className="font-medium">
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
                remoteTypingUsers.length > 0 ? (
                  <div className="mt-1 flex items-center justify-start gap-2 text-xs text-muted-foreground">
                    <span>
                      {isGroupConversation
                        ? remoteTypingUsers.length === 1
                          ? `${remoteTypingUsers[0]} is typing…`
                          : remoteTypingUsers.length === 2
                            ? `${remoteTypingUsers[0]} and ${remoteTypingUsers[1]} are typing…`
                            : "Several people are typing…"
                        : "Typing…"}
                    </span>
                    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                    </span>
                  </div>
                ) : (
                  <div className="h-1" aria-hidden />
                )
              }
              followOutput={isAtBottom ? "smooth" : false}
              onAtBottomChange={setIsAtBottom}
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

                const previous = index > 0 ? (visibleMessages[index - 1]?.message ?? null) : null;
                const next =
                  index < visibleMessages.length - 1
                    ? (visibleMessages[index + 1]?.message ?? null)
                    : null;

                const previousSameSender =
                  previous != null && previous.senderId === message.senderId;
                const nextSameSender = next != null && next.senderId === message.senderId;

                const isCloseToPrevious =
                  previousSameSender &&
                  isWithinGroupingWindow(previous.createdAt, message.createdAt);
                const isCloseToNext =
                  nextSameSender && isWithinGroupingWindow(message.createdAt, next.createdAt);

                const startsGroup = !(previousSameSender && isCloseToPrevious);
                const endsGroup = !(nextSameSender && isCloseToNext);

                const showDateDivider =
                  index === 0 ||
                  (previous != null &&
                    !isSameCalendarDate(new Date(previous.createdAt), new Date(message.createdAt)));

                const stackSpacing =
                  index === 0 || showDateDivider ? "mt-0" : startsGroup ? "mt-3" : "mt-1.5";

                const isDeletedMessage = meta.deleted === true;
                const editedAt = meta.editedAt;
                const deletedAt = meta.deletedAt;

                const name = sender?.displayName ?? (isSelf ? "You" : "Someone");
                const text = isDeletedMessage
                  ? "This message was deleted"
                  : parseMessageText(message.body);

                const messageAriaLabel = (() => {
                  const senderLabel = isSelf ? "You" : name;

                  if (isDeletedMessage) {
                    return `${senderLabel} deleted a message`;
                  }

                  if (text) {
                    return `${senderLabel} said: ${text}`;
                  }

                  if (message.attachmentUrl) {
                    return `${senderLabel} sent an attachment`;
                  }

                  return `${senderLabel} sent a message`;
                })();

                const showAvatarAndName = !isSelf && endsGroup;

                const handleBubbleToggle = () => {
                  if (longPressTriggeredRef.current) {
                    longPressTriggeredRef.current = false;
                    return;
                  }
                  if (activeActionMessageId === message.id) {
                    setActiveActionMessageId(null);
                  } else {
                    openMessageActions(message);
                  }
                };

                return (
                  <div className="px-0" key={message.id}>
                    {showDateDivider && (
                      <div className="my-4 flex items-center justify-center">
                        <div className="inline-flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="h-px w-12 bg-border" aria-hidden="true" />
                          <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
                            {formatMessageDateLabel(message.createdAt)}
                          </span>
                          <span className="h-px w-12 bg-border" aria-hidden="true" />
                        </div>
                      </div>
                    )}

                    <div className={`flex w-full flex-col gap-0.5 ${stackSpacing}`}>
                      <div
                        className={`flex w-full items-end gap-2 ${
                          isSelf ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!isSelf && (
                          <>
                            {showAvatarAndName ? (
                              <div className="mt-auto h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                                {sender?.avatarUrl ? (
                                  <img
                                    src={sender.avatarUrl}
                                    alt={sender.displayName ?? undefined}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                                    {name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-auto h-7 w-7 flex-shrink-0" />
                            )}
                          </>
                        )}

                        <MessageBubble
                          isSelf={isSelf}
                          isDeleted={isDeletedMessage}
                          onClick={handleBubbleToggle}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            handleBubbleToggle();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleBubbleToggle();
                            }
                          }}
                          onTouchStart={() => handleBubbleTouchStart(message)}
                          onTouchEnd={handleBubbleTouchEndOrCancel}
                          onTouchCancel={handleBubbleTouchEndOrCancel}
                          aria-label={messageAriaLabel}
                        >
                          {text && (
                            <p className="whitespace-pre-wrap break-all text-sm leading-snug">
                              {text}
                            </p>
                          )}

                          {!isDeletedMessage && message.attachmentUrl && (
                            <ChatImage path={message.attachmentUrl} />
                          )}
                        </MessageBubble>
                      </div>

                      {reactions.length > 0 && (
                        <div
                          className={`mt-0.5 flex w-full ${
                            isSelf ? "justify-end pr-6" : "justify-start pl-6"
                          }`}
                        >
                          <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-foreground">
                            {reactions.map((reaction) => (
                              <button
                                key={reaction.emoji}
                                type="button"
                                onClick={() =>
                                  toggleReaction.mutate({
                                    messageId: message.id,
                                    emoji: reaction.emoji,
                                  })
                                }
                                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-background ${
                                  reaction.reactedBySelf ? "bg-primary/10" : ""
                                }`}
                              >
                                <span className="text-[17px]">{reaction.emoji}</span>
                                {reaction.count > 1 && (
                                  <span className="text-xs text-muted-foreground">
                                    {reaction.count}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeActionMessageId === message.id && !isDeletedMessage && (
                        <div
                          className={`mt-1 flex w-full ${
                            isSelf ? "justify-end pr-6" : "justify-start pl-6"
                          }`}
                        >
                          <div className="inline-flex flex-col items-stretch gap-1 rounded-2xl bg-muted px-2.5 py-1.5 text-xs text-foreground select-none">
                            <div className="flex items-center justify-center gap-1">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    toggleReaction.mutate({
                                      messageId: message.id,
                                      emoji,
                                    });
                                    setActiveActionMessageId(null);
                                  }}
                                  className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-background"
                                >
                                  <span className="text-[17px]">{emoji}</span>
                                </button>
                              ))}
                            </div>

                            {isSelf && (
                              <div className="mt-1 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    editTriggerRef.current = event.currentTarget;
                                    setEditingMessage({
                                      messageId: message.id,
                                      text: parseMessageText(message.body) ?? "",
                                    });
                                    setEditError(null);
                                    setActiveActionMessageId(null);
                                    if (textareaRef.current) {
                                      textareaRef.current.blur();
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-background"
                                >
                                  <Edit3 className="h-3.5 w-3.5" aria-hidden />
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMessageId(null);
                                    setDeleteDialog({ messageId: message.id });
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {showDeliveryStatus && deliveryStatus && (
                        <div
                          className={`flex items-center gap-1 text-xs text-muted-foreground ${
                            isSelf ? "justify-end pr-1" : "justify-start pl-7"
                          }`}
                        >
                          {deliveryStatus.status === "failed" ? (
                            <>
                              <AlertCircle className="h-3 w-3 text-destructive" aria-hidden />
                              <span>Failed to send.</span>
                              <button
                                type="button"
                                className="text-destructive underline"
                                onClick={() => handleRetryMessage(message)}
                              >
                                Retry
                              </button>
                            </>
                          ) : deliveryStatus.status === "delivered" ? (
                            <>
                              <Check className="h-3 w-3" aria-hidden />
                              <span>Delivered</span>
                            </>
                          ) : (
                            <>
                              <CheckCheck className="h-3 w-3" aria-hidden />
                              <span>Seen</span>
                            </>
                          )}
                        </div>
                      )}

                      {isDeletedMessage && deletedAt && (
                        <p
                          className={`text-xs text-muted-foreground ${
                            isSelf ? "text-right pr-1" : "text-left pl-7"
                          }`}
                        >
                          Deleted {formatMessageTime(deletedAt)}
                        </p>
                      )}

                      {!isDeletedMessage && editedAt && (
                        <p
                          className={`text-xs text-muted-foreground ${
                            isSelf ? "text-right pr-1" : "text-left pl-7"
                          }`}
                        >
                          Edited {formatMessageTime(editedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }}
            />

          </div>

          {/* Input */}
          {!isBlocked && !blockedYou && (
            <MessageComposer
              onSubmit={handleSubmit}
              className="space-y-3"
            >
              {sendError && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-xs text-destructive"
                >
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <p className="font-semibold">Couldn&apos;t send. Please try again.</p>
                  </div>
                  {lastFailedPayload && (
                    <Button type="button" size="sm" variant="outline" onClick={handleRetrySend}>
                      Retry
                    </Button>
                  )}
                </div>
              )}

              {uploadError && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-xs text-destructive"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <p className="font-semibold">{uploadError}</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setUploadError(null)}>
                    Dismiss
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Add emoji"
                      className="h-10 w-10"
                    >
                      <Smile className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="p-3">
                    <ScrollArea className="max-h-64">
                      <div className="grid grid-cols-8 gap-1.5">
                        {["😀","😁","😂","🤣","😅","😆","😉","😊","😎","😍","🥰","😘","🤩","🥹","🙂","🙃","🤔","🤨","😏","😒","😭","😢","😡","🤯","🥳","👍","👎","🙌","👏","🙏","❤️","🧡","💛","💚","💙","💜","🔥","⭐","✨","👀","🎬","🍿","🎉","💯"].map((emoji) => (
                          <Button
                            key={emoji}
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-lg"
                            onClick={() => {
                              handleEmojiSelect(emoji);
                              setShowEmojiPicker(false);
                            }}
                          >
                            <span>{emoji}</span>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={handleCameraClick}
                  aria-label="Send photo"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelected}
                />

                <div className="flex max-h-[160px] flex-1 items-center rounded-md border border-input bg-background px-3 py-2">
                  <Textarea
                    id="conversation-message"
                    value={draft}
                    ref={textareaRef}
                    onChange={handleDraftChange}
                    onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (draft.trim()) {
                          event.currentTarget.form?.requestSubmit();
                        }
                      }
                    }}
                    rows={1}
                    className="h-auto max-h-[140px] min-h-[44px] resize-none border-0 bg-transparent px-0 py-0 text-sm focus-visible:ring-0"
                  />
                </div>

                <Button
                  type="submit"
                  variant="default"
                  size="icon"
                  className="h-11 w-11"
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  disabled={!draft.trim()}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </MessageComposer>
          )}

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

      <Dialog open={Boolean(editingMessage)} onOpenChange={(open) => (!open ? closeEditDialog() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit message</DialogTitle>
            <DialogDescription>Update your message for everyone in the conversation.</DialogDescription>
          </DialogHeader>

          {editingMessage && (
            <Textarea
              ref={editTextareaRef}
              value={editingMessage.text}
              onChange={(event) =>
                setEditingMessage((prev) => (prev ? { ...prev, text: event.target.value } : prev))
              }
              rows={3}
              className="min-h-[120px]"
            />
          )}

          {editError && <p className="text-xs text-destructive">{editError}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!editingMessage?.text.trim() || editMessageMutation.isPending}
              onClick={() => {
                if (!editingMessage) return;
                const text = editingMessage.text.trim();
                if (!text) return;
                setEditError(null);
                editMessageMutation.mutate(
                  {
                    messageId: editingMessage.messageId,
                    text,
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
            >
              {editMessageMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>Save</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteDialog)} onOpenChange={(open) => (!open ? setDeleteDialog(null) : undefined)}>
        <DialogContent>
          <DialogHeader className="gap-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <Trash2 className="h-4 w-4" aria-hidden />
              </span>
              Delete message
            </DialogTitle>
            <DialogDescription>
              Choose whether to remove this message only from your chat or from the conversation for everyone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (!deleteDialog) return;
                setHiddenMessageIds((prev) => ({
                  ...prev,
                  [deleteDialog.messageId]: true,
                }));
                setDeleteDialog(null);
              }}
            >
              Delete for me
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={deleteMessageMutation.isPending}
              onClick={() => {
                if (!deleteDialog) return;
                deleteMessageMutation.mutate(
                  { messageId: deleteDialog.messageId },
                  {
                    onSettled: () => {
                      setDeleteDialog(null);
                    },
                  },
                );
              }}
            >
              {deleteMessageMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>Delete for everyone</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

const getMessageDeliveryStatus = (
  message: ConversationMessage,
  conversation: ConversationListItem | null,
  deliveryReceipts: MessageDeliveryReceipt[] | undefined,
  readReceipts: ConversationReadReceipt[] | undefined,
  currentUserId: string | null | undefined,
  failedMessages: Record<string, FailedMessagePayload>,
): MessageDeliveryStatus | null => {
  if (!conversation || !currentUserId) return null;
  if (message.senderId !== currentUserId) return null;

  if (failedMessages[message.id]) {
    return { status: "failed" };
  }

  if (message.id.startsWith("temp-")) {
    return { status: "sending" };
  }

  const others = conversation.participants.filter((p) => !p.isSelf);
  if (others.length === 0) return null;

  const otherIds = others.map((p) => p.id);
  const messageTime = new Date(message.createdAt).getTime();

  const allDeliveryReceipts = deliveryReceipts ?? [];
  const deliveredUsers = allDeliveryReceipts.filter(
    (r) => r.messageId === message.id && otherIds.includes(r.userId),
  );
  const deliveredCount = deliveredUsers.length;

  const allReadReceipts = readReceipts ?? [];
  let seenCount = 0;
  let latestSeenAtMs: number | null = null;

  for (const other of others) {
    const receipt = allReadReceipts.find((r) => r.userId === other.id);
    if (!receipt || !receipt.lastReadAt) continue;
    const receiptTime = new Date(receipt.lastReadAt).getTime();
    if (Number.isNaN(receiptTime)) continue;
    if (receiptTime >= messageTime) {
      seenCount += 1;
      if (latestSeenAtMs === null || receiptTime > latestSeenAtMs) {
        latestSeenAtMs = receiptTime;
      }
    }
  }

  if (seenCount === others.length && others.length > 0) {
    const seenAtIso = latestSeenAtMs != null ? new Date(latestSeenAtMs).toISOString() : null;
    return { status: "seen", seenAt: seenAtIso };
  }

  if (deliveredCount > 0) {
    return { status: "delivered" };
  }

  return { status: "sent" };
};

export default ConversationPage;
