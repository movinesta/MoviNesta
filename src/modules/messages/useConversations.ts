/**
 * Polls Supabase for the current user's conversation list and shapes the
 * results for UI display (participants, last message preview, unread state).
 * Uses short refetch intervals instead of realtime to keep the experience
 * simple; a future realtime channel can replace the polling layer when ready.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Database } from "@/types/supabase";
import { useAuth } from "../auth/AuthProvider";
import { getMessagePreview } from "./messageText";
import { formatTimeAgo } from "./formatTimeAgo";

type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["conversation_participants"]["Row"];
type MessageRow = Pick<
  Database["public"]["Tables"]["messages"]["Row"],
  "id" | "conversation_id" | "user_id" | "body" | "created_at"
>;
type ReadReceiptRow = Pick<
  Database["public"]["Tables"]["message_read_receipts"]["Row"],
  "conversation_id" | "user_id" | "last_read_at" | "last_read_message_id"
>;

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

export const useConversations = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<ConversationListItem[]>({
    queryKey: ["conversations", userId],
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: userId ? 8000 : false,
    refetchIntervalInBackground: true,

    queryFn: async (): Promise<ConversationListItem[]> => {
      if (!userId) return [];

      // 1) Which conversations does the current user participate in?
      const { data: participantRows, error: participantsError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      if (participantsError) {
        console.error("[useConversations] Failed to load participants", participantsError);
        throw new Error(participantsError.message);
      }

      if (!participantRows || participantRows.length === 0) {
        return [];
      }

      const conversationIds = Array.from(
        new Set(
          participantRows
            .map((row) => row.conversation_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      if (conversationIds.length === 0) {
        return [];
      }

      // 2) Fetch conversations metadata
      const { data: conversationsData, error: conversationsError } = await supabase
        .from("conversations")
        .select("id, is_group, title, created_at, updated_at, created_by")
        .in("id", conversationIds)
        .order("updated_at", { ascending: false });

      if (conversationsError) {
        console.error("[useConversations] Failed to load conversations", conversationsError);
        throw new Error(conversationsError.message);
      }

      const conversations: ConversationRow[] = conversationsData ?? [];

      // 3) Fetch participants for these conversations
      const { data: allParticipantsData, error: allParticipantsError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id, role, created_at")
        .in("conversation_id", conversationIds);

      if (allParticipantsError) {
        console.error(
          "[useConversations] Failed to load conversation participants",
          allParticipantsError,
        );
        throw new Error(allParticipantsError.message);
      }

      const allParticipants: ParticipantRow[] = allParticipantsData ?? [];

      // 4) Collect all user ids we need profiles for
      const userIds = Array.from(new Set(allParticipants.map((row) => row.user_id)));

      // 5) Fetch profiles for participants
      let profilesById = new Map<
        string,
        {
          id: string;
          username: string | null;
          displayName: string | null;
          avatarUrl: string | null;
        }
      >();
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        if (profilesError) {
          console.error("[useConversations] Failed to load profiles", profilesError);
          throw new Error(profilesError.message);
        }

        profilesById = new Map(
          (profilesData ?? []).map((row) => [
            row.id,
            {
              id: row.id,
              username: row.username,
              displayName: row.display_name,
              avatarUrl: row.avatar_url,
            },
          ]),
        );
      }

      // 6) Fetch recent messages for these conversations (we'll compute "last message")
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("id, conversation_id, user_id, body, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      if (messagesError) {
        console.error("[useConversations] Failed to load messages", messagesError);
        throw new Error(messagesError.message);
      }

      const messages: MessageRow[] = messagesData ?? [];

      // Group messages by conversation id, newest first (thanks to the ordering above)
      const messagesByConversation = new Map<string, MessageRow[]>();
      for (const msg of messages) {
        const convId = msg.conversation_id;
        if (!messagesByConversation.has(convId)) {
          messagesByConversation.set(convId, []);
        }
        messagesByConversation.get(convId)!.push(msg);
      }

      // 7) Read receipts for these conversations (all participants)
      const { data: receiptsData, error: receiptsError } = await supabase
        .from("message_read_receipts")
        .select("conversation_id, user_id, last_read_at, last_read_message_id")
        .in("conversation_id", conversationIds);

      if (receiptsError) {
        console.error("[useConversations] Failed to load read receipts", receiptsError);
        throw new Error(receiptsError.message);
      }

      const receiptsByConversation = new Map<
        string,
        {
          selfLastReadAt: string | null;
          selfLastReadMessageId: string | null;
          others: { userId: string; lastReadAt: string | null; lastReadMessageId: string | null }[];
        }
      >();

      const typedReceipts: ReadReceiptRow[] = receiptsData ?? [];

      for (const row of typedReceipts) {
        const convId = row.conversation_id;
        const userIdForRow = row.user_id;
        const lastReadAt = row.last_read_at ?? null;
        const lastReadMessageId = row.last_read_message_id ?? null;

        let entry = receiptsByConversation.get(convId);
        if (!entry) {
          entry = { selfLastReadAt: null, selfLastReadMessageId: null, others: [] };
          receiptsByConversation.set(convId, entry);
        }

        if (userIdForRow === userId) {
          entry.selfLastReadAt = lastReadAt;
          entry.selfLastReadMessageId = lastReadMessageId;
        } else {
          entry.others.push({ userId: userIdForRow, lastReadAt, lastReadMessageId });
        }
      }

      // 8) Compose final list items
      const result: ConversationListItem[] = conversations.map((conv) => {
        const convId = conv.id;
        const isGroup = Boolean(conv.is_group);
        const participantsForConv = allParticipants.filter((row) => row.conversation_id === convId);

        const participantModels: ConversationParticipant[] = participantsForConv.map((row) => {
          const profile = profilesById.get(row.user_id);
          const displayName = profile?.displayName ?? profile?.username ?? "Unknown user";

          return {
            id: profile?.id ?? row.user_id,
            displayName,
            username: profile?.username ?? null,
            avatarUrl: profile?.avatarUrl ?? null,
            isSelf: row.user_id === userId,
          };
        });

        const others = participantModels.filter((p) => !p.isSelf);
        const selfIncluded = participantModels.some((p) => p.isSelf);

        let title: string;
        let subtitle: string;

        if (isGroup) {
          title =
            conv.title ??
            (others.length > 0
              ? others
                  .slice(0, 3)
                  .map((p) => p.displayName)
                  .join(", ")
              : "Group conversation");
          subtitle =
            others.length > 0 ? `${participantModels.length} participants` : "Group conversation";
        } else {
          const primaryOther = others[0] ?? participantModels[0];
          title = primaryOther?.displayName ?? "Direct message";
          subtitle =
            primaryOther?.username != null
              ? `@${primaryOther.username}`
              : selfIncluded && others.length === 0
                ? "Just you"
                : "Direct message";
        }

        const convMessages = messagesByConversation.get(convId) ?? [];
        const lastMessage = convMessages[0];
        const lastMessagePreview = lastMessage ? getMessagePreview(lastMessage.body) : null;
        const lastMessageAt = lastMessage?.created_at ?? conv.updated_at ?? conv.created_at ?? null;
        const lastMessageAtLabel = formatTimeAgo(lastMessageAt);

        const receipt = receiptsByConversation.get(convId);
        const selfLastReadAt = receipt?.selfLastReadAt ?? null;
        const selfLastReadMessageId = receipt?.selfLastReadMessageId ?? null;

        const hasUnread =
          !!lastMessage &&
          ((selfLastReadMessageId && selfLastReadMessageId !== lastMessage.id) ||
            (!selfLastReadMessageId &&
              lastMessageAt &&
              (!selfLastReadAt ||
                new Date(lastMessageAt).getTime() > new Date(selfLastReadAt).getTime())));

        const lastMessageIsFromSelf = !!lastMessage && lastMessage.user_id === userId;

        let lastMessageSeenByOthers = false;

        if (!isGroup && lastMessage && lastMessageIsFromSelf && lastMessageAt) {
          const othersReceipts = receipt?.others ?? [];
          const other = othersReceipts[0];

          if (other?.lastReadMessageId) {
            if (other.lastReadMessageId === lastMessage.id) {
              lastMessageSeenByOthers = true;
            }
          } else if (other?.lastReadAt) {
            const msgTime = new Date(lastMessageAt).getTime();
            const otherReadTime = new Date(other.lastReadAt).getTime();
            if (
              !Number.isNaN(msgTime) &&
              !Number.isNaN(otherReadTime) &&
              otherReadTime >= msgTime
            ) {
              lastMessageSeenByOthers = true;
            }
          }
        }

        return {
          id: convId,
          isGroup,
          title,
          subtitle,
          participants: participantModels,
          lastMessagePreview,
          lastMessageAt: lastMessageAt ?? null,
          lastMessageAtLabel,
          hasUnread,
          lastMessageIsFromSelf,
          lastMessageSeenByOthers,
        };
      });

      const sorted = [...result].sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        const safeATime = Number.isNaN(aTime) ? 0 : aTime;
        const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
        return safeBTime - safeATime;
      });

      return sorted;
    },
  });
};
