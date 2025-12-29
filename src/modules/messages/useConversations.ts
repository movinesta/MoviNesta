import { conversationsQueryKey } from "./queryKeys";
/**
 * Polls Supabase for the current user's conversation list and shapes the
 * results for UI display (participants, last message preview, unread state).
 * Uses short refetch intervals instead of realtime to keep the experience
 * simple; a future realtime channel can replace the polling layer when ready.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { getMessagePreview } from "./messageText";
import { formatTimeAgo } from "./formatTimeAgo";
import { safeTime } from "./time";

type ConversationSummaryRow = {
  conversation_id: string;
  is_group: boolean | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_id: string | null;
  last_message_body: string | null;
  last_message_created_at: string | null;
  last_message_user_id: string | null;
  last_message_display_name: string | null;
  last_message_username: string | null;
  participants: unknown;
  self_last_read_message_id: string | null;
  self_last_read_at: string | null;
  participant_receipts: unknown;
};

type RpcParticipant = {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  isSelf: boolean;
};

type RpcReadReceipt = {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
};

export interface ConversationParticipant {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  isSelf: boolean;
}

export interface ConversationListItem {
  id: string;
  isGroup: boolean;
  title: string;
  subtitle: string;
  participants: ConversationParticipant[];
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastMessageAtLabel: string | null;
  hasUnread: boolean;
  lastMessageIsFromSelf: boolean;
  lastMessageSeenByOthers: boolean;
}

export const fetchConversationSummaries = async (
  userId: string,
): Promise<ConversationListItem[]> => {
  // Database function uses auth.uid() to determine the user (no args).
  // Do not pass an (even empty) args object: PostgREST may treat it as a signature with parameters
  // and look for a cached function variant (e.g. get_conversation_summaries(p_user_id)).
  const { data, error } = await (supabase.rpc as any)("get_conversation_summaries");

  if (error) {
    console.error("[useConversations] Failed to load conversation summaries", error);
    throw new Error(error.message);
  }

  const summaries: ConversationSummaryRow[] = data ?? [];

  return summaries.map((summary) => {
    const participants = Array.isArray(summary.participants)
      ? (summary.participants as RpcParticipant[])
      : [];

    const receipts = Array.isArray(summary.participant_receipts)
      ? (summary.participant_receipts as RpcReadReceipt[])
      : [];

    const others = participants.filter((p) => !p.isSelf);
    const selfIncluded = participants.some((p) => p.isSelf);
    const isGroup = Boolean(summary.is_group);

    let title: string;
    let subtitle: string;

    if (isGroup) {
      title =
        summary.title ??
        (others.length > 0
          ? others
              .slice(0, 3)
              .map((p) => p.displayName ?? p.username ?? "Unknown user")
              .join(", ")
          : "Group conversation");
      subtitle = others.length > 0 ? `${participants.length} participants` : "Group conversation";
    } else {
      const primaryOther = others[0] ?? participants[0];
      title =
        primaryOther?.displayName ?? primaryOther?.username ?? summary.title ?? "Direct message";
      subtitle =
        primaryOther?.username != null
          ? `@${primaryOther.username}`
          : selfIncluded && others.length === 0
            ? "Just you"
            : "Direct message";
    }

    const lastMessagePreview = summary.last_message_body
      ? getMessagePreview(summary.last_message_body)
      : null;

    const lastMessageAt =
      summary.last_message_created_at ?? summary.updated_at ?? summary.created_at ?? null;
    const lastMessageAtLabel = formatTimeAgo(lastMessageAt);

    const selfLastReadAt = summary.self_last_read_at ?? null;
    const selfLastReadMessageId = summary.self_last_read_message_id ?? null;

    const hasUnread =
      !!summary.last_message_id &&
      !!(
        (selfLastReadMessageId && selfLastReadMessageId !== summary.last_message_id) ||
        (!selfLastReadMessageId &&
          lastMessageAt &&
          (!selfLastReadAt || safeTime(lastMessageAt) > safeTime(selfLastReadAt)))
      );

    const lastMessageIsFromSelf = summary.last_message_user_id === userId;

    let lastMessageSeenByOthers = false;

    if (!isGroup && summary.last_message_id && lastMessageIsFromSelf && lastMessageAt) {
      const otherReceipt = receipts.find((r) => r.userId !== userId);

      if (otherReceipt?.lastReadMessageId) {
        lastMessageSeenByOthers = otherReceipt.lastReadMessageId === summary.last_message_id;
      } else if (otherReceipt?.lastReadAt) {
        const msgTime = new Date(lastMessageAt).getTime();
        const otherReadTime = new Date(otherReceipt.lastReadAt).getTime();
        if (!Number.isNaN(msgTime) && !Number.isNaN(otherReadTime) && otherReadTime >= msgTime) {
          lastMessageSeenByOthers = true;
        }
      }
    }

    return {
      id: summary.conversation_id,
      isGroup,
      title,
      subtitle,
      participants: participants.map((p) => ({
        id: p.id,
        displayName: p.displayName ?? p.username ?? "Unknown user",
        username: p.username,
        avatarUrl: p.avatarUrl,
        isSelf: p.isSelf,
      })),
      lastMessagePreview,
      lastMessageAt: lastMessageAt ?? null,
      lastMessageAtLabel,
      hasUnread,
      lastMessageIsFromSelf,
      lastMessageSeenByOthers,
    };
  });
};

export const useConversations = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<ConversationListItem[]>({
    queryKey: conversationsQueryKey(userId),
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: userId ? () => (document?.hidden ? false : 8000) : false,
    refetchIntervalInBackground: true,

    queryFn: async (): Promise<ConversationListItem[]> => {
      if (!userId) return [];
      return fetchConversationSummaries(userId);
    },
  });
};