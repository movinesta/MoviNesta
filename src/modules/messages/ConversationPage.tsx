import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Edit3,
  Image as ImageIcon,
  Info,
  Loader2,
  Phone,
  Send,
  Smile,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { HeaderSurface } from "../../components/PageChrome";
import { useAuth } from "../auth/AuthProvider";
import { formatDate, formatTime } from "@/utils/format";
import type { ConversationListItem, ConversationParticipant } from "./useConversations";
import { useConversations } from "./useConversations";
import { parseMessageText } from "./messageText";
import { useBlockStatus } from "./useBlockStatus";

interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  createdAt: string;
  body: string | null;
  attachmentUrl: string | null;
}

interface ConversationReadReceipt {
  userId: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
}

interface MessageReaction {
  id: string;
  conversationId: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

interface MessageDeliveryReceipt {
  id: string;
  conversationId: string;
  messageId: string;
  userId: string;
  deliveredAt: string;
}

type MessageDeliveryStatusValue = "sending" | "sent" | "delivered" | "seen" | "failed";

interface MessageDeliveryStatus {
  status: MessageDeliveryStatusValue;
  seenAt?: string | null;
}

type ParsedBodyMeta = {
  editedAt?: string;
  deletedAt?: string;
  deleted?: boolean;
};

type FailedMessagePayload = {
  text: string;
  attachmentPath: string | null;
};

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "😍"];

const getMessageMeta = (body: string | null): ParsedBodyMeta => {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      return {
        editedAt: typeof parsed.editedAt === "string" ? parsed.editedAt : undefined,
        deletedAt: typeof parsed.deletedAt === "string" ? parsed.deletedAt : undefined,
        deleted: parsed.deleted === true,
      };
    }
  } catch {
    // ignore parse errors
  }
  return {};
};

const formatMessageTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatTime(date, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const useConversationMessages = (conversationId: string | null) => {
  return useQuery<ConversationMessage[]>({
    queryKey: ["conversation", conversationId, "messages"],
    enabled: Boolean(conversationId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: conversationId ? 6000 : false,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<ConversationMessage[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, user_id, body, attachment_url, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[ConversationPage] Failed to load messages", error);
        throw new Error(error.message);
      }

      return (data ?? []).map((row: any) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        senderId: row.user_id as string,
        body: (row.body as string | null) ?? null,
        attachmentUrl: (row.attachment_url as string | null) ?? null,
        createdAt: row.created_at as string,
      }));
    },
  });
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
        .eq("conversation_id", conversationId);

      if (error) {
        console.error("[ConversationPage] Failed to load read receipts", error);
        throw new Error(error.message);
      }

      return (data ?? []).map((row: any) => ({
        userId: row.user_id as string,
        lastReadAt: (row.last_read_at as string | null) ?? null,
        lastReadMessageId: (row.last_read_message_id as string | null) ?? null,
      }));
    },
  });
};

const useConversationReactions = (conversationId: string | null) => {
  return useQuery<MessageReaction[]>({
    queryKey: ["conversation", conversationId, "reactions"],
    enabled: Boolean(conversationId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: conversationId ? 15000 : false,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<MessageReaction[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("message_reactions")
        .select("id, conversation_id, message_id, user_id, emoji, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[ConversationPage] Failed to load reactions", error);
        throw new Error(error.message);
      }

      return (data ?? []).map((row: any) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        messageId: row.message_id as string,
        userId: row.user_id as string,
        emoji: row.emoji as string,
        createdAt: row.created_at as string,
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

      return (data ?? []).map((row: any) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        messageId: row.message_id as string,
        userId: row.user_id as string,
        deliveredAt: (row.delivered_at as string | null) ?? row.created_at,
      }));
    },
  });
};

interface SendMessageArgs {
  text: string;
  attachmentPath?: string | null;
}

const useSendMessage = (
  conversationId: string | null,
  options?: {
    onFailed?: (tempId: string, payload: FailedMessagePayload) => void;
    onRecovered?: (tempId: string | null) => void;
  },
) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ text, attachmentPath }: SendMessageArgs) => {
      if (!conversationId) throw new Error("Missing conversation id.");
      if (!userId) throw new Error("You must be signed in to send messages.");

      const trimmed = text.trim();
      const bodyPayload =
        attachmentPath && trimmed
          ? { type: "text+image", text: trimmed }
          : attachmentPath
            ? { type: "image", text: "" }
            : { type: "text", text: trimmed };

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          body: JSON.stringify(bodyPayload),
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

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();

      const optimistic: ConversationMessage = {
        id: tempId,
        conversationId,
        senderId: userId,
        body: JSON.stringify({ type: "text", text: text.trim() }),
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
        payload: { text: text.trim(), attachmentPath: attachmentPath ?? null },
      };
    },
    onError: (error, _variables, context) => {
      console.error("[ConversationPage] sendMessage error", error);
      if (conversationId) {
        const { previousMessages, optimistic, payload, tempId } = context ?? {};
        const base = previousMessages ??
          queryClient.getQueryData<ConversationMessage[]>([
            "conversation",
            conversationId,
            "messages",
          ]) ?? [];

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

const useToggleReaction = (conversationId: string | null) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!conversationId) throw new Error("Missing conversation id.");
      if (!userId) throw new Error("You must be signed in to react to messages.");

      const { error } = await supabase.from("message_reactions").insert({
        conversation_id: conversationId,
        message_id: messageId,
        user_id: userId,
        emoji,
      });

      if (error) {
        if ((error as any).code === "23505") {
          const { error: deleteError } = await supabase
            .from("message_reactions")
            .delete()
            .eq("conversation_id", conversationId)
            .eq("message_id", messageId)
            .eq("user_id", userId)
            .eq("emoji", emoji);

          if (deleteError) {
            console.error("[ConversationPage] Failed to remove reaction", deleteError);
            throw deleteError;
          }
          return;
        }

        console.error("[ConversationPage] Failed to toggle reaction", error);
        throw error;
      }
    },
    onMutate: async ({ messageId, emoji }) => {
      if (!conversationId || !userId) {
        return { previousReactions: undefined as MessageReaction[] | undefined };
      }

      const queryKey = ["conversation", conversationId, "reactions"];
      await queryClient.cancelQueries({ queryKey });
      const previousReactions = queryClient.getQueryData<MessageReaction[]>(queryKey);

      queryClient.setQueryData<MessageReaction[]>(queryKey, (existing) => {
        const current = existing ?? [];
        const existingIdx = current.findIndex(
          (r) => r.messageId === messageId && r.userId === userId && r.emoji === emoji,
        );

        if (existingIdx >= 0) {
          const next = [...current];
          next.splice(existingIdx, 1);
          return next;
        }

        const optimistic: MessageReaction = {
          id: `temp-${Date.now()}`,
          conversationId,
          messageId,
          userId,
          emoji,
          createdAt: new Date().toISOString(),
        };
        return [...current, optimistic];
      });

      return { previousReactions };
    },
    onError: (_error, _variables, context) => {
      if (!conversationId) return;
      const queryKey = ["conversation", conversationId, "reactions"];
      if (context?.previousReactions) {
        queryClient.setQueryData(queryKey, context.previousReactions);
      } else {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onSuccess: () => {
      if (!conversationId) return;
      queryClient.invalidateQueries({
        queryKey: ["conversation", conversationId, "reactions"],
      });
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
    const run = async () => {
      const { data, error: err } = await supabase.storage
        .from("chat-media")
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
    return <div className="mt-1 text-[11px] text-mn-text-muted">Image unavailable.</div>;
  }

  if (!url) {
    return <div className="mt-1 h-32 w-40 animate-pulse rounded-xl bg-mn-border-subtle/40" />;
  }

  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-mn-border-subtle/70 bg-mn-bg/80">
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

  const sendMessage = useSendMessage(conversationId, {
    onFailed: handleSendFailed,
    onRecovered: handleSendRecovered,
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (selectedImagePreview) {
        URL.revokeObjectURL(selectedImagePreview);
      }
    };
  }, [selectedImagePreview]);

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

  const conversation: ConversationListItem | null = useMemo(() => {
    if (!conversationId || !conversations) return null;
    return conversations.find((c) => c.id === conversationId) ?? null;
  }, [conversationId, conversations]);

  const participantsById = useMemo(() => {
    const map = new Map<string, ConversationParticipant>();
    if (!conversation) return map;
    for (const participant of conversation.participants) {
      map.set(participant.id, participant);
    }
    return map;
  }, [conversation]);

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
  const { data: reactions } = useConversationReactions(conversationId);
  const { data: deliveryReceipts } = useConversationDeliveryReceipts(conversationId);

  const toggleReaction = useToggleReaction(conversationId);
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

  const [editError, setEditError] = useState<string | null>(null);

  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, { emoji: string; count: number; reactedBySelf: boolean }[]>();

    if (!reactions) return map;

    for (const reaction of reactions) {
      const existing = map.get(reaction.messageId) ?? [];
      let entry = existing.find((e) => e.emoji === reaction.emoji);
      if (!entry) {
        entry = {
          emoji: reaction.emoji,
          count: 0,
          reactedBySelf: false,
        };
        existing.push(entry);
        map.set(reaction.messageId, existing);
      }
      entry.count += 1;
      if (user?.id && reaction.userId === user.id) {
        entry.reactedBySelf = true;
      }
    }

    return map;
  }, [reactions, user?.id]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

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
              .then(({ error }) => {
                if (error) {
                  console.error("[ConversationPage] Failed to insert delivery receipt", error);
                }
              })
              .catch((err) => {
                console.error(
                  "[ConversationPage] Unexpected error inserting delivery receipt",
                  err,
                );
              });
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
      .then(() => {
        lastReadRef.current = {
          conversationId,
          messageId: last.id,
          userId: user.id,
        };
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .catch((error) => {
        console.error("[ConversationPage] Failed to update read receipt", error);
      });
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
          queryClient.invalidateQueries({
            queryKey: ["conversation", conversationId, "reactions"],
          });
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
  }, [conversationId, queryClient]);

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

  // Close emoji when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

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
    sendMessage.mutate({ text: payload.text, attachmentPath: payload.attachmentPath }, {
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
    });
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

  const handleRetryMessage = (messageId: string) => {
    const payload = failedMessages[messageId];
    if (!payload || !conversationId) return;
    setSendError(null);
    setFailedMessages((prev) => {
      if (!(messageId in prev)) return prev;
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
    queryClient.setQueryData<ConversationMessage[]>(
      ["conversation", conversationId, "messages"],
      (existing) => (existing ?? []).filter((m) => m.id !== messageId),
    );
    attemptSend(payload);
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
    if (isBlocked || blockedYou) return;

    const previewUrl = URL.createObjectURL(file);
    if (selectedImagePreview) {
      URL.revokeObjectURL(selectedImagePreview);
    }

    setSelectedImageFile(file);
    setSelectedImagePreview(previewUrl);
    setShowGalleryPicker(true);
  };

  const handleCloseGallery = () => {
    if (selectedImagePreview) {
      URL.revokeObjectURL(selectedImagePreview);
    }
    setSelectedImagePreview(null);
    setSelectedImageFile(null);
    setShowGalleryPicker(false);
  };

  const handleSendSelectedImage = async () => {
    if (!selectedImageFile || !conversationId || !user?.id) return;
    if (isBlocked || blockedYou) return;

    setIsUploadingImage(true);

    try {
      const ext = selectedImageFile.name.split(".").pop() ?? "jpg";
      const path = `${conversationId}/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(path, selectedImageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("[ConversationPage] image upload error", uploadError);
        return;
      }

      attemptSend({ text: "", attachmentPath: path });
      handleCloseGallery();
    } catch (error) {
      console.error("[ConversationPage] handleSendSelectedImage failed", error);
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
        <div className="max-w-md rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 px-5 py-6 text-center text-sm text-mn-text-primary shadow-mn-card">
          <h1 className="text-base font-heading font-semibold">Conversation not found</h1>
          <p className="mt-2 text-xs text-mn-text-secondary">
            This page is meant to be opened from your messages list.
          </p>
          <p className="mt-4">
            <Link
              to="/messages"
              className="inline-flex items-center justify-center rounded-full border border-mn-border-subtle bg-mn-bg px-3 py-1.5 text-[12px] font-medium text-mn-text-primary shadow-mn-soft transition hover:border-mn-primary/70 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              Back to messages
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-stretch bg-mn-bg">
      <div
        className="pointer-events-none absolute inset-x-10 top-4 h-32 rounded-full bg-gradient-to-r from-fuchsia-500/15 via-mn-primary/10 to-blue-500/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col items-stretch rounded-none border border-mn-border-subtle/70 bg-mn-bg shadow-xl shadow-mn-primary/5 backdrop-blur sm:rounded-3xl">
        {/* Header */}
        <HeaderSurface className="min-h-[3.5rem] flex-shrink-0 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/messages")}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-mn-bg-elevated/80 text-mn-text-primary shadow-mn-soft transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Back to messages</span>
            </button>

            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-mn-bg-elevated ring-2 ring-mn-border-subtle">
                <div
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/25 via-mn-primary/20 to-blue-500/25"
                  aria-hidden="true"
                />
                <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-mn-bg ring-1 ring-white/30">
                  {!isGroupConversation && otherParticipant ? (
                    otherParticipant.avatarUrl ? (
                      <img
                        src={otherParticipant.avatarUrl}
                        alt={otherParticipant.displayName ?? undefined}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[13px] font-semibold text-mn-text-primary">
                        {(otherParticipant.displayName ?? "U").slice(0, 2).toUpperCase()}
                      </span>
                    )
                  ) : (
                    <Users className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-heading font-semibold text-mn-text-primary">
                  {conversation?.title ?? otherParticipant?.displayName ?? "Conversation"}
                </h1>
                <p className="truncate text-[11px] text-mn-text-secondary">
                  {conversation
                    ? conversation.lastMessageAtLabel
                      ? `Active ${conversation.lastMessageAtLabel}`
                      : (conversation.subtitle ??
                        (isGroupConversation
                          ? `${conversation.participants.length} participants`
                          : "Active now"))
                    : isConversationsLoading
                      ? "Loading…"
                      : "Details unavailable"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-mn-text-secondary">
            {conversation && conversation.participants.length > 1 && (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mn-bg-elevated/70 shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg"
                aria-label="Audio call"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {conversation && conversation.participants.length > 1 && (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mn-bg-elevated/70 shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg"
                aria-label="Video call"
              >
                <Video className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {conversation && (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mn-bg-elevated/70 shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg"
                aria-label="Conversation info"
              >
                <Info className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {!isGroupConversation && otherParticipant && (
              <button
                type="button"
                disabled={block.isPending || unblock.isPending}
                onClick={() => {
                  if (youBlocked) {
                    unblock.mutate();
                  } else {
                    block.mutate();
                  }
                }}
                className="ml-1 hidden items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-500/10 via-mn-primary/10 to-blue-500/10 px-3 py-1.5 text-[11px] font-semibold text-mn-text-primary ring-1 ring-mn-border-subtle/70 transition hover:-translate-y-0.5 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg disabled:opacity-60 sm:inline-flex"
              >
                {(block.isPending || unblock.isPending) && (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                )}
                <span>{youBlocked ? "Unblock" : "Block"}</span>
              </button>
            )}
          </div>
        </HeaderSurface>

        {/* Body + input */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col bg-gradient-to-b from-mn-bg via-mn-bg to-mn-bg">
            <div
              className="pointer-events-none absolute inset-x-8 top-4 h-20 rounded-full bg-gradient-to-r from-fuchsia-500/10 via-mn-primary/10 to-blue-500/10 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative flex flex-1 flex-col overflow-y-auto px-4 py-4 text-sm">
              {isLoading && !hasMessages && (
                <div className="flex h-full items-center justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-mn-border-subtle bg-mn-bg/80 px-3 py-1.5 text-[12px] text-mn-text-secondary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Loading messages…</span>
                  </div>
                </div>
              )}

              {isMessagesError && (
                <div className="mb-3 rounded-md border border-mn-border-subtle bg-mn-bg/90 px-3 py-2 text-[12px] text-mn-error">
                  <p className="font-medium">We couldn&apos;t load this conversation.</p>
                  {messagesError instanceof Error && (
                    <p className="mt-1 text-[11px] text-mn-text-secondary">
                      {messagesError.message}
                    </p>
                  )}
                </div>
              )}

              {!isLoading && !isMessagesError && !hasMessages && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-[12px] text-mn-text-secondary">
                    <p className="font-medium">
                      {isGroupConversation ? "No messages in this group yet." : "No messages yet."}
                    </p>
                    <p className="mt-1">
                      {isGroupConversation
                        ? "Be the first to start the conversation."
                        : "Say hi to start the conversation."}
                    </p>
                  </div>
                </div>
              )}

              {messages?.map((message, index) => {
                // "Delete for me" hides message locally only
                if (hiddenMessageIds[message.id]) {
                  return null;
                }

                const participant = participantsById.get(message.senderId);
                const isSelf =
                  participant?.isSelf ?? (user?.id != null && message.senderId === user.id);

                const previous = index > 0 ? (messages?.[index - 1] ?? null) : null;
                const next =
                  index < (messages?.length ?? 0) - 1 ? (messages?.[index + 1] ?? null) : null;

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

                const baseBubbleColors = isSelf
                  ? "bg-mn-primary/90 text-white shadow-md shadow-mn-primary/20"
                  : "bg-mn-bg-elevated text-mn-text-primary border border-mn-border-subtle/80 shadow-mn-soft";

                const meta = getMessageMeta(message.body);
                const isDeletedMessage = meta.deleted === true;
                const editedAt = meta.editedAt;
                const deletedAt = meta.deletedAt;

                const bubbleColors = isDeletedMessage
                  ? "bg-mn-bg-elevated/80 text-mn-text-muted border border-dashed border-mn-border-subtle/80"
                  : baseBubbleColors;

                const bubbleShape = isSelf
                  ? "rounded-tr-3xl rounded-tl-3xl rounded-bl-3xl rounded-br-2xl"
                  : "rounded-tr-3xl rounded-tl-3xl rounded-br-3xl rounded-bl-2xl";
                const name = participant?.displayName ?? (isSelf ? "You" : "Someone");

                const text = isDeletedMessage
                  ? "This message was deleted"
                  : parseMessageText(message.body);

                const showAvatarAndName = !isSelf && endsGroup;

                const messageReactions = reactionsByMessageId.get(message.id) ?? [];

                const deliveryStatus = getMessageDeliveryStatus(
                  message,
                  conversation ?? null,
                  deliveryReceipts,
                  readReceipts,
                  user?.id ?? null,
                  failedMessages,
                );

                const isLastOwnMessage = isSelf && lastOwnMessageId === message.id;
                const showDeliveryStatus =
                  isSelf &&
                  !isDeletedMessage &&
                  deliveryStatus &&
                  (deliveryStatus.status === "failed" || isLastOwnMessage);

                const handleBubbleToggle = () => {
                  // One tap toggles reaction/action bar.
                  // If this click comes right after a long press, ignore it so the menu doesn't instantly close.
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
                  <React.Fragment key={message.id}>
                    {showDateDivider && (
                      <div className="my-4 flex items-center justify-center">
                        <div className="inline-flex items-center gap-3 text-[11px] text-mn-text-muted">
                          <span
                            className="h-px w-12 bg-gradient-to-r from-transparent via-mn-border-subtle to-transparent"
                            aria-hidden="true"
                          />
                          <span className="rounded-full bg-mn-bg px-3 py-0.5 text-[11px] font-medium text-mn-text-secondary shadow-mn-soft/60 ring-1 ring-mn-border-subtle/70">
                            {formatMessageDateLabel(message.createdAt)}
                          </span>
                          <span
                            className="h-px w-12 bg-gradient-to-r from-transparent via-mn-border-subtle to-transparent"
                            aria-hidden="true"
                          />
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
                              <div className="mt-auto h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-mn-bg/80 ring-1 ring-mn-border-subtle">
                                {participant?.avatarUrl ? (
                                  <img
                                    src={participant.avatarUrl}
                                    alt={participant.displayName ?? undefined}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-mn-text-secondary">
                                    {name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-auto h-7 w-7 flex-shrink-0" />
                            )}
                          </>
                        )}

                        <button
                          type="button"
                          className={`inline-flex max-w-[80%] px-4 py-2.5 text-[13px] ${bubbleShape} ${bubbleColors} select-none transition-transform duration-150 ease-out`}
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
                        >
                          <div className="flex flex-col">
                            {text && (
                              <p className="whitespace-pre-wrap break-all text-[13px] leading-snug">
                                {text}
                              </p>
                            )}

                            {!isDeletedMessage && message.attachmentUrl && (
                              <ChatImage path={message.attachmentUrl} />
                            )}
                          </div>
                        </button>
                      </div>

                      {messageReactions.length > 0 && (
                        <div
                          className={`mt-0.5 flex w-full ${
                            isSelf ? "justify-end pr-6" : "justify-start pl-6"
                          }`}
                        >
                          <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-mn-bg-elevated/80 px-1.5 py-0.5 text-[11px] text-mn-text-primary shadow-mn-soft ring-1 ring-mn-border-subtle/70">
                            {messageReactions.map((reaction) => (
                              <button
                                key={reaction.emoji}
                                type="button"
                                onClick={() =>
                                  toggleReaction.mutate({
                                    messageId: message.id,
                                    emoji: reaction.emoji,
                                  })
                                }
                                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition transform hover:bg-mn-bg hover:scale-110 active:scale-90 ${
                                  reaction.reactedBySelf
                                    ? "bg-mn-primary/5 ring-1 ring-mn-primary/40"
                                    : ""
                                }`}
                              >
                                <span className="text-[17px]">{reaction.emoji}</span>
                                {reaction.count > 1 && (
                                  <span className="text-[10px] text-mn-text-secondary">
                                    {reaction.count}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Inline Telegram-style reaction bar + edit/delete */}
                      {activeActionMessageId === message.id && !isDeletedMessage && (
                        <div
                          className={`mt-1 flex w-full ${
                            isSelf ? "justify-end pr-6" : "justify-start pl-6"
                          }`}
                        >
                          <div className="inline-flex flex-col items-stretch gap-1 rounded-2xl bg-mn-bg-elevated/95 px-2.5 py-1.5 text-[11px] text-mn-text-primary shadow-mn-soft ring-1 ring-mn-border-subtle/70 select-none">
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
                                  className="flex h-7 w-7 items-center justify-center rounded-full transition transform hover:bg-mn-bg hover:-translate-y-0.5 hover:scale-110 active:scale-90"
                                >
                                  <span className="text-[17px]">{emoji}</span>
                                </button>
                              ))}
                            </div>

                            {isSelf && (
                              <div className="mt-1 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
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
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-mn-text-secondary hover:bg-mn-bg"
                                >
                                  <Edit3 className="h-3 w-3" aria-hidden="true" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteDialog({ messageId: message.id });
                                    setActiveActionMessageId(null);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-mn-error hover:bg-mn-bg"
                                >
                                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className={`flex w-full ${isSelf ? "justify-end" : "justify-start"}`}>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-mn-text-muted">
                          <span>{formatMessageTime(message.createdAt)}</span>

                          {editedAt && !isDeletedMessage && (
                            <span>· edited {formatMessageTime(editedAt)}</span>
                          )}

                          {isDeletedMessage && deletedAt && (
                            <span>· deleted {formatMessageTime(deletedAt)}</span>
                          )}

                          {/* Only show delivery/seen indicator on the last outgoing message */}
                          {showDeliveryStatus && deliveryStatus && (
                            <span
                              className={`inline-flex items-center gap-1 ${
                                deliveryStatus.status === "failed" ? "text-mn-error" : ""
                              }`}
                            >
                              {deliveryStatus.status === "sending" && (
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                              )}
                              {deliveryStatus.status === "sent" && (
                                <Check className="h-3 w-3" aria-hidden="true" />
                              )}
                              {deliveryStatus.status === "delivered" && (
                                <CheckCheck className="h-3 w-3" aria-hidden="true" />
                              )}
                              {deliveryStatus.status === "seen" && (
                                <>
                                  <CheckCheck
                                    className="h-3 w-3 text-mn-primary"
                                    aria-hidden="true"
                                  />
                                  {deliveryStatus.seenAt && (
                                    <span>{formatMessageTime(deliveryStatus.seenAt)}</span>
                                  )}
                                </>
                              )}
                              {deliveryStatus.status === "failed" && (
                                <>
                                  <Info className="h-3 w-3" aria-hidden="true" />
                                  <span>Failed to send</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRetryMessage(message.id)}
                                    className="inline-flex items-center gap-1 rounded-full bg-mn-primary/10 px-2 py-0.5 text-[10px] font-semibold text-mn-primary ring-1 ring-mn-primary/40 transition hover:-translate-y-0.5"
                                  >
                                    Retry
                                  </button>
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              {remoteTypingUsers.length > 0 && (
                <div className="mt-1 flex items-center justify-start gap-2 text-[11px] text-mn-text-muted">
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
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mn-text-muted" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mn-text-muted" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mn-text-muted" />
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Emoji picker popover */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-[4.25rem] left-4 z-30 rounded-2xl border border-mn-border-subtle/60 bg-mn-bg-elevated/95 p-2 shadow-mn-card"
              >
                <div className="flex max-w-[260px] flex-wrap gap-1.5">
                  {[
                    "😀",
                    "😁",
                    "😂",
                    "🤣",
                    "😅",
                    "😆",
                    "😉",
                    "😊",
                    "😎",
                    "😍",
                    "🥰",
                    "😘",
                    "🤩",
                    "🥹",
                    "🙂",
                    "🙃",
                    "🤔",
                    "🤨",
                    "😏",
                    "😒",
                    "😭",
                    "😢",
                    "😡",
                    "🤯",
                    "🥳",
                    "👍",
                    "👎",
                    "🙌",
                    "👏",
                    "🙏",
                    "❤️",
                    "🧡",
                    "💛",
                    "💚",
                    "💙",
                    "💜",
                    "🔥",
                    "⭐",
                    "✨",
                    "👀",
                    "🎬",
                    "🍿",
                    "🎉",
                    "💯",
                  ].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        handleEmojiSelect(emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-bg text-lg transition hover:bg-mn-bg/70"
                    >
                      <span>{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          {!isBlocked && !blockedYou && (
            <form
              onSubmit={handleSubmit}
              className="sticky bottom-0 z-20 flex-shrink-0 space-y-2 border-t border-mn-border-subtle/70 bg-mn-bg/95 px-4 py-3 backdrop-blur"
            >
              {sendError && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-xl border border-mn-border-subtle/70 bg-mn-bg px-3 py-2 text-[11px] text-mn-error"
                >
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <p className="font-semibold">Couldn&apos;t send. Please try again.</p>
                  </div>
                  {lastFailedPayload && (
                    <button
                      type="button"
                      onClick={handleRetrySend}
                      className="inline-flex items-center gap-1 rounded-full bg-mn-primary/10 px-2 py-1 text-[11px] font-semibold text-mn-primary ring-1 ring-mn-primary/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  ref={emojiButtonRef}
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mn-bg-elevated/80 text-mn-text-secondary shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                  aria-label="Add emoji"
                >
                  <Smile className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={handleCameraClick}
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mn-bg-elevated/80 text-mn-text-secondary shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                  aria-label="Send photo"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelected}
                />

                <div className="flex min-h-[44px] max-h-[160px] flex-1 items-center rounded-full bg-mn-bg px-4 py-2.5 text-[13px] text-mn-text-primary shadow-inner ring-1 ring-mn-border-subtle/70 focus-within:outline-none focus-within:ring-0 focus-within:shadow-none">
                  <textarea
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
                    placeholder="Message…"
                    rows={1}
                    className="max-h-[160px] flex-1 resize-none bg-transparent text-[13px] text-mn-text-primary outline-none placeholder:text-mn-text-muted focus:border-transparent focus:outline-none focus:ring-0 focus:shadow-none"
                  />
                </div>

                <button
                  type="submit"
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  disabled={!draft.trim()}
                  className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-mn-primary to-blue-500 text-white shadow-lg shadow-mn-primary/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {blockedYou && (
            <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-mn-border-subtle bg-mn-bg/95 px-4 py-3 text-center text-[11px] text-mn-text-muted">
              <p>You can&apos;t send messages because this user has blocked you.</p>
            </div>
          )}

          {isBlocked && !blockedYou && (
            <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-mn-border-subtle bg-mn-bg/95 px-4 py-3 text-center text-[11px] text-mn-text-muted">
              <p>You&apos;ve blocked this user. Unblock them to continue the conversation.</p>
            </div>
          )}
        </section>
      </div>

      {/* Edit message modal */}
      {editingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[min(480px,calc(100%-2.5rem))] rounded-2xl border border-mn-border-subtle/80 bg-mn-bg-elevated p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-mn-text-primary">Edit message</h2>
              <button
                type="button"
                onClick={() => {
                  setEditingMessage(null);
                  setEditError(null);
                }}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-mn-bg text-mn-text-secondary shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                aria-label="Close edit message"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 rounded-2xl bg-mn-bg px-3 py-2 ring-1 ring-mn-border-subtle/70">
              <textarea
                value={editingMessage.text}
                onChange={(event) =>
                  setEditingMessage((prev) => (prev ? { ...prev, text: event.target.value } : prev))
                }
                rows={3}
                className="w-full resize-none border-0 bg-transparent text-[13px] text-mn-text-primary outline-none focus:outline-none focus:ring-0"
              />
            </div>

            {editError && <p className="mt-2 text-[11px] text-mn-error">{editError}</p>}

            <div className="mt-4 flex justify-end gap-2 text-[13px]">
              <button
                type="button"
                onClick={() => {
                  setEditingMessage(null);
                  setEditError(null);
                }}
                className="rounded-full px-3 py-1.5 text-mn-text-secondary hover:bg-mn-bg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!editingMessage.text.trim() || editMessageMutation.isPending}
                onClick={() => {
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
                        setEditingMessage(null);
                      },
                      onError: () => {
                        setEditError("Couldn't save changes. Please try again.");
                      },
                    },
                  );
                }}
                className="inline-flex items-center gap-1 rounded-full bg-mn-primary px-3 py-1.5 text-white shadow-mn-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editMessageMutation.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                )}
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete message dialog (Delete for me / Delete for everyone) */}
      {deleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[min(420px,calc(100%-2.5rem))] rounded-2xl border border-mn-border-subtle/80 bg-mn-bg-elevated p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mn-error/10 text-mn-error">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </div>
                <h2 className="text-[15px] font-semibold text-mn-text-primary">Delete message</h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteDialog(null)}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-mn-bg text-mn-text-secondary shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                aria-label="Close delete dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-3 text-[12px] text-mn-text-secondary">
              Choose whether to remove this message only from your chat or from the conversation for
              everyone.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHiddenMessageIds((prev) => ({
                      ...prev,
                      [deleteDialog.messageId]: true,
                    }));
                    setDeleteDialog(null);
                  }}
                  className="flex-1 rounded-full bg-mn-bg px-3 py-2 text-[13px] font-semibold text-mn-text-primary shadow-mn-soft ring-1 ring-mn-border-subtle/80 transition hover:-translate-y-0.5 hover:bg-mn-bg-elevated"
                >
                  Delete for me
                </button>
                <button
                  type="button"
                  disabled={deleteMessageMutation.isPending}
                  onClick={() => {
                    deleteMessageMutation.mutate(
                      { messageId: deleteDialog.messageId },
                      {
                        onSettled: () => {
                          setDeleteDialog(null);
                        },
                      },
                    );
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-mn-error px-3 py-2 text-[13px] font-semibold text-white shadow-mn-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {deleteMessageMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  )}
                  <span>Delete for everyone</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDeleteDialog(null)}
                className="self-center text-[12px] text-mn-text-secondary hover:text-mn-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery picker */}
      {showGalleryPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-[min(520px,calc(100%-2rem))] rounded-3xl border border-mn-border-subtle/70 bg-mn-bg/95 p-5 shadow-2xl">
            <button
              type="button"
              onClick={handleCloseGallery}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-mn-bg-elevated/80 text-mn-text-secondary shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              aria-label="Close gallery picker"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-3 pr-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/10 via-mn-primary/10 to-blue-500/10 text-mn-text-primary ring-1 ring-mn-border-subtle">
                <Camera className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-mn-text-primary">
                  Send from your gallery
                </h2>
                <p className="text-[12px] text-mn-text-secondary">
                  Pick a recent photo to drop into the chat—just like Instagram DMs.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-mn-border-subtle/80 bg-mn-bg/80 p-4">
              {selectedImagePreview ? (
                <div className="overflow-hidden rounded-xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80">
                  <img
                    src={selectedImagePreview}
                    alt="Selected"
                    className="max-h-[320px] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-mn-text-muted">
                  <ImageIcon className="h-8 w-8" aria-hidden="true" />
                  <p className="text-[13px] text-mn-text-secondary">
                    Choose a photo from your camera roll.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full bg-mn-bg-elevated/80 px-4 py-2 text-[13px] font-semibold text-mn-text-primary shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                >
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  <span>Choose another photo</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendSelectedImage}
                  disabled={!selectedImageFile || isUploadingImage}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-mn-primary to-blue-500 px-4 py-2 text-[13px] font-semibold text-white الكرةshadow-lg shadow-mn-primary/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{isUploadingImage ? "Sending…" : "Send photo"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const isSameCalendarDate = (a: Date, b: Date): boolean => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const formatMessageDateLabel = (iso: string): string => {
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

const isWithinGroupingWindow = (
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
