import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Info,
  Loader2,
  Phone,
  Send,
  Smile,
  Users,
  Video,
  X,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { HeaderSurface } from "../../components/PageChrome";
import { useAuth } from "../auth/AuthProvider";
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
  attachmentUrl: string | null; // storage path, e.g. "conversationId/userId/file.jpg"
}

interface ConversationReadReceipt {
  userId: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
}

const formatMessageTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
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
        .select("id, conversation_id, sender_id, body, attachment_url, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[ConversationPage] Failed to load messages", error);
        throw new Error(error.message);
      }

      return (data ?? []).map((row: any) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        senderId: row.sender_id as string,
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

interface SendMessageArgs {
  text: string;
  attachmentPath?: string | null;
}

const useSendMessage = (conversationId: string | null) => {
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
          sender_id: userId,
          body: JSON.stringify(bodyPayload),
          attachment_url: attachmentPath ?? null,
        })
        .select("id, conversation_id, sender_id, body, attachment_url, created_at")
        .single();

      if (error) {
        console.error("[ConversationPage] Failed to send message", error);
        throw new Error(error.message);
      }

      const row: ConversationMessage = {
        id: data.id as string,
        conversationId: data.conversation_id as string,
        senderId: data.sender_id as string,
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
    // Optimistic update for instant feel
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

      await queryClient.cancelQueries({ queryKey: ["conversation", conversationId, "messages"] });
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

      return { previousMessages, tempId };
    },
    onError: (error, _variables, context) => {
      console.error("[ConversationPage] sendMessage error", error);
      if (context?.previousMessages && conversationId) {
        queryClient.setQueryData(
          ["conversation", conversationId, "messages"],
          context.previousMessages,
        );
      }
    },
    onSuccess: (row, _variables, context) => {
      if (!conversationId) return;
      const tempId = context?.tempId;

      queryClient.setQueryData<ConversationMessage[]>(
        ["conversation", conversationId, "messages"],
        (existing) => {
          const current = existing ?? [];
          // Remove optimistic temp message if present
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
    },
  });
};

/**
 * Renders an attachment image from chat-media bucket using a signed URL.
 */
const ChatImage: React.FC<{ path: string }> = ({ path }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data, error: err } = await supabase.storage
        .from("chat-media")
        .createSignedUrl(path, 60 * 60); // 1 hour

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
  const { conversationId: conversationIdParam } = useParams<{ conversationId: string }>();
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

  const sendMessage = useSendMessage(conversationId);

  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
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

  const typingStateRef = useRef<{ isTyping: boolean; timeoutId: number | null }>({
    isTyping: false,
    timeoutId: null,
  });

  const { data: readReceipts } = useConversationReadReceipts(conversationId);

  const latestSelfMessage = useMemo(() => {
    if (!messages || !user?.id) return null;
    const selfMessages = messages.filter((m) => m.senderId === user.id);
    return selfMessages.length > 0 ? selfMessages[selfMessages.length - 1] : null;
  }, [messages, user?.id]);

  const seenSummary = useMemo(() => {
    if (!conversation || !latestSelfMessage || !readReceipts || !user?.id) {
      return null;
    }

    const others = conversation.participants.filter((p) => !p.isSelf);
    if (others.length === 0) return null;

    const seenParticipants: ConversationParticipant[] = [];
    let earliestSeenAt: string | null = null;

    for (const other of others) {
      const receipt = readReceipts.find((r) => r.userId === other.id);
      if (!receipt || !receipt.lastReadAt) continue;

      const receiptTime = new Date(receipt.lastReadAt).getTime();
      const messageTime = new Date(latestSelfMessage.createdAt).getTime();

      if (Number.isNaN(receiptTime) || Number.isNaN(messageTime)) continue;
      if (receiptTime >= messageTime) {
        seenParticipants.push(other);
        if (!earliestSeenAt || receiptTime < new Date(earliestSeenAt).getTime()) {
          earliestSeenAt = receipt.lastReadAt;
        }
      }
    }

    if (seenParticipants.length === 0) return null;

    return { seenParticipants, earliestSeenAt };
  }, [conversation, latestSelfMessage, readReceipts, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  useEffect(() => {
    lastReadRef.current = { conversationId: null, messageId: null, userId: null };
  }, [conversationId, user?.id]);

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

  // Realtime: new messages
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
            sender_id: string;
            body: string | null;
            attachment_url: string | null;
            created_at: string;
          };

          if (user?.id && row.sender_id === user.id) {
            return;
          }

          const newMessage: ConversationMessage = {
            id: row.id,
            conversationId: row.conversation_id,
            senderId: row.sender_id,
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
        lastReadRef.current = { conversationId, messageId: last.id, userId: user.id };
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

  const attemptSend = (text: string) => {
    sendMessage.mutate(
      { text, attachmentPath: null },
      {
        onError: (error) => {
          console.error("[ConversationPage] sendMessage mutate error", error);
          setSendError("Couldn't send. Please try again.");
          setDraft(text);
          resizeTextarea();
          setLastFailedText(text);
        },
        onSuccess: () => {
          setSendError(null);
          setLastFailedText(null);
        },
      },
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (isBlocked || blockedYou) return;

    const text = draft.trim();
    if (!text || sendMessage.isPending) return;

    // Instant clear for "instant" feeling
    setDraft("");
    resizeTextarea();
    setSendError(null);
    setLastFailedText(null);
    notifyTyping("");

    attemptSend(text);
  };

  const handleRetrySend = () => {
    if (!lastFailedText || sendMessage.isPending) return;
    setSendError(null);
    attemptSend(lastFailedText);
  };

  // ✅ UPDATED: camera click now directly opens the OS file picker
  const handleCameraClick = () => {
    if (!conversationId || !user?.id) return;
    if (isBlocked || blockedYou) return;

    // This triggers the native gallery / file selection UI immediately
    fileInputRef.current?.click();
  };

  // After user selects an image from the native picker, show the preview modal
  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Allow selecting the same file again later
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

      sendMessage.mutate({ text: "", attachmentPath: path });
      handleCloseGallery();
    } catch (error) {
      console.error("[ConversationPage] handleSendSelectedImage failed", error);
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex min-height-[60vh] items-center justify-center px-4">
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
    <div className="relative flex h-full min-h-[60vh] flex-1 flex-col items-stretch bg-mn-bg">
      <div
        className="pointer-events-none absolute inset-x-10 top-4 h-32 rounded-full bg-gradient-to-r from-fuchsia-500/15 via-mn-primary/10 to-blue-500/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col items-stretch rounded-3xl border border-mn-border-subtle/70 bg-mn-bg/90 shadow-xl shadow-mn-primary/5 backdrop-blur">
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
          <div className="relative flex min-h-0 flex-1 flex-col bg-gradient-to-b from-mn-bg/92 via-mn-bg/88 to-mn-bg/92">
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
                const participant = participantsById.get(message.senderId);
                const isSelf =
                  participant?.isSelf ?? (user?.id != null && message.senderId === user.id);

                const isLatestSelfMessage =
                  latestSelfMessage != null && latestSelfMessage.id === message.id;

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

                const bubbleColors = isSelf
                  ? "bg-mn-primary/90 text-white shadow-md shadow-mn-primary/20"
                  : "bg-mn-bg-elevated text-mn-text-primary border border-mn-border-subtle/80 shadow-mn-soft";
                const bubbleShape = isSelf
                  ? "rounded-tr-3xl rounded-tl-3xl rounded-bl-3xl rounded-br-2xl"
                  : "rounded-tr-3xl rounded-tl-3xl rounded-br-3xl rounded-bl-2xl";
                const name = participant?.displayName ?? (isSelf ? "You" : "Someone");

                const text = parseMessageText(message.body);

                const showAvatarAndName = !isSelf && endsGroup;
                const showTimestamp = endsGroup;

                const timestampAlignClass = isSelf ? "text-right" : "text-left";

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

                        <div
                          className={`inline-flex max-w-[80%] px-4 py-2.5 text-[13px] ${bubbleShape} ${bubbleColors}`}
                        >
                          <div className="flex flex-col">
                            {text && (
                              <p className="whitespace-pre-wrap break-all text-[13px] leading-snug">
                                {text}
                              </p>
                            )}

                            {message.attachmentUrl && <ChatImage path={message.attachmentUrl} />}
                          </div>
                        </div>
                      </div>

                      <div className={`flex w-full ${isSelf ? "justify-end" : "justify-start"}`}>
                        {showTimestamp && (
                          <p
                            className={`mt-0.5 text-[10px] text-mn-text-muted ${timestampAlignClass}`}
                          >
                            {formatMessageTime(message.createdAt)}
                          </p>
                        )}
                      </div>

                      {isSelf && isLatestSelfMessage && seenSummary && (
                        <div className="flex w-full justify-end">
                          <p className="mt-0.5 text-[10px] text-mn-text-muted">
                            {isGroupConversation
                              ? seenSummary.seenParticipants.length === 1
                                ? `Seen by ${seenSummary.seenParticipants[0].displayName}`
                                : `Seen by ${seenSummary.seenParticipants[0].displayName} and ${
                                    seenSummary.seenParticipants.length - 1
                                  } others`
                              : seenSummary.earliestSeenAt
                                ? `Seen ${formatMessageTime(seenSummary.earliestSeenAt)}`
                                : "Seen"}
                          </p>
                        </div>
                      )}
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
                <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                  {[
                    "😀",
                    "😂",
                    "😍",
                    "🥹",
                    "😎",
                    "🤔",
                    "😭",
                    "🔥",
                    "❤️",
                    "👍",
                    "👀",
                    "🎬",
                    "🍿",
                    "⭐",
                    "🙌",
                  ].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        handleEmojiSelect(emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-bg hover:bg-mn-bg/70 text-lg transition"
                    >
                      <span>{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input at the very bottom, full width */}
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
                  {lastFailedText && (
                    <button
                      type="button"
                      onClick={handleRetrySend}
                      disabled={sendMessage.isPending}
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
                    className="max-h-[160px] flex-1 resize-none bg-transparent text-[13px] text-mn-text-primary outline-none placeholder:text-mn-text-muted focus:outline-none focus:ring-0 focus:shadow-none focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!draft.trim() || sendMessage.isPending}
                  className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-mn-primary to-blue-500 text-white shadow-lg shadow-mn-primary/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
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
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-mn-primary to-blue-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-mn-primary/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
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

  return date.toLocaleDateString(undefined, {
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

export default ConversationPage;
