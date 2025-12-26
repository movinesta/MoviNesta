import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { conversationMessagesQueryKey } from "./queryKeys";
import type { ConversationMessage, FailedMessagePayload } from "./messageModel";
import type { ConversationMessagesPage } from "./useConversationMessages";
import { fetchBlockStatus } from "./useBlockStatus";
import { getMessagePreview } from "./messageText";
import { formatTimeAgo } from "./formatTimeAgo";
import { createRandomTempId, ensureTempId } from "./idUtils";
import { createClientId } from "./clientId";
import { updateConversationListItemInCache } from "./conversationsCache";
import { MESSAGE_SELECT } from "./messageSelect";
import {
  ensureMessagesInfiniteData,
  reconcileSentMessage,
  upsertMessageIntoNewestPage,
} from "./conversationMessagesCache";

interface SendMessageArgs {
  text: string;
  attachmentPath?: string | null;
  clientId?: string;
  tempId?: string;
}

type SendMessageContext = {
  previous: InfiniteData<ConversationMessagesPage> | undefined;
  /** The optimistic id used for this attempt (null when onMutate early-exits). */
  tempId: string | null;
  optimistic?: ConversationMessage;
  payload?: FailedMessagePayload;
};
const buildMessagePayload = (text: string, attachmentPath: string | null, clientId: string) => {
  const trimmed = text.trim();

  if (!attachmentPath && !trimmed) {
    return { payload: null, trimmed } as const;
  }

  if (attachmentPath && trimmed) {
    return { payload: { type: "text+image", text: trimmed, clientId }, trimmed } as const;
  }

  if (attachmentPath) {
    return { payload: { type: "image", text: "", clientId }, trimmed } as const;
  }

  return { payload: { type: "text", text: trimmed, clientId }, trimmed } as const;
};

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

  return useMutation<ConversationMessage, Error, SendMessageArgs, SendMessageContext>({
    mutationFn: async ({ text, attachmentPath, clientId }: SendMessageArgs) => {
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

      const effectiveClientId = clientId ?? createClientId();

      const { payload } = buildMessagePayload(text, attachmentPath ?? null, effectiveClientId);
      if (!payload) {
        throw new Error("Cannot send an empty message.");
      }

      const { data, error } = await supabase
        .from("messages" as any)
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          sender_id: userId,

          body: payload,
          message_type: payload.type,
          text: (payload as any).text ?? null,
          client_id: (payload as any).clientId ?? null,
          meta: payload,
          attachment_url: attachmentPath ?? null,
        })
        .select(MESSAGE_SELECT)
        .single();

      if (error) {
        console.error("[useSendMessage] Failed to send message", error);
        throw new Error(error.message);
      }

      const row: ConversationMessage = {
        id: (data as any).id as string,
        conversationId: (data as any).conversation_id as string,
        senderId: (data as any).user_id as string,
        // body can be legacy string, JSON-string, or JSON object depending on migrations.
        body: ((data as any).body as unknown) ?? null,
        attachmentUrl: ((data as any).attachment_url as string | null) ?? null,
        createdAt: (data as any).created_at as string,
      };

      // Conversation updated_at is bumped server-side via a trigger on message insert.

      return row;
    },
    onMutate: async (variables) => {
      if (!conversationId || !userId) return { previous: undefined, tempId: null };

      const { text, attachmentPath } = variables;

      const effectiveClientId = variables.clientId ?? createClientId();
      // React Query passes the same variables object through to mutationFn.
      // Mutating it here allows mutationFn to reuse the same clientId.
      variables.clientId = effectiveClientId;

      const { payload, trimmed } = buildMessagePayload(
        text,
        attachmentPath ?? null,
        effectiveClientId,
      );
      if (!payload) {
        throw new Error("Cannot send an empty message.");
      }

      const requestedTempId = variables.tempId;
      const tempId =
        typeof requestedTempId === "string" && requestedTempId.length
          ? ensureTempId(requestedTempId)
          : createRandomTempId();
      const createdAt = new Date().toISOString();

      const optimistic: ConversationMessage = {
        id: tempId,
        conversationId,
        senderId: userId,
        body: payload,
        attachmentUrl: attachmentPath ?? null,
        createdAt,
      };

      const messagesKey = conversationMessagesQueryKey(conversationId);

      await queryClient.cancelQueries({ queryKey: messagesKey });
      const previous =
        queryClient.getQueryData<InfiniteData<ConversationMessagesPage>>(messagesKey);

      queryClient.setQueryData<InfiniteData<ConversationMessagesPage>>(messagesKey, (existing) => {
        return upsertMessageIntoNewestPage(existing, optimistic);
      });

      return {
        previous,
        tempId,
        optimistic,
        payload: {
          text: trimmed,
          attachmentPath: attachmentPath ?? null,
          clientId: effectiveClientId,
        },
      };
    },
    onError: (error, _variables, context) => {
      console.error("[useSendMessage] sendMessage error", error);
      if (!conversationId) return;

      const { previous, optimistic, payload, tempId } = context ?? {
        previous: undefined,
        tempId: null,
      };
      const messagesKey = conversationMessagesQueryKey(conversationId);

      queryClient.setQueryData<InfiniteData<ConversationMessagesPage>>(messagesKey, (existing) => {
        if (!optimistic) return ensureMessagesInfiniteData(previous ?? existing);
        return upsertMessageIntoNewestPage(previous ?? existing, optimistic);
      });

      if (tempId && payload && options?.onFailed) {
        options.onFailed(tempId, payload);
      }
    },
    onSuccess: (row, _variables, context) => {
      if (!conversationId) return;
      const tempId = context?.tempId;
      const messagesKey = conversationMessagesQueryKey(conversationId);

      queryClient.setQueryData<InfiniteData<ConversationMessagesPage>>(messagesKey, (existing) => {
        return reconcileSentMessage(existing, { tempId, row });
      });

      // Update inbox list cache optimistically (the list is also polled).
      updateConversationListItemInCache(
        queryClient,
        conversationId,
        (current) => ({
          ...current,
          lastMessagePreview: getMessagePreview(row.body) ?? current.lastMessagePreview,
          lastMessageAt: row.createdAt ?? current.lastMessageAt,
          lastMessageAtLabel: formatTimeAgo(row.createdAt ?? null),
          hasUnread: false,
          lastMessageIsFromSelf: true,
          lastMessageSeenByOthers: false,
        }),
        { moveToTop: true },
      );

      if (options?.onRecovered) {
        options.onRecovered(context?.tempId ?? null);
      }
    },
  });
};
