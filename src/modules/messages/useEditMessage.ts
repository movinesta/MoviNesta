import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { mapMessageRowToConversationMessage, type MessageRow } from "./messageModel";
import type { ConversationMessagesPage } from "./useConversationMessages";
import { conversationMessagesQueryKey } from "./queryKeys";
import { buildEditedMessageBody, parseMessageBody } from "./messageText";
import { replaceMessageById } from "./conversationMessagesCache";
import { MESSAGE_SELECT } from "./messageSelect";
import type { Database, Json } from "@/types/supabase";

const allowedMessageTypes = new Set<Database["public"]["Enums"]["message_type"]>([
  "text",
  "image",
  "text+image",
  "system",
]);

export const useEditMessage = (conversationId: string | null) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      text,
      currentBody,
      attachmentUrl,
    }: {
      messageId: string;
      text: string;
      currentBody: string | null;
      attachmentUrl: string | null;
    }) => {
      if (!conversationId) throw new Error("Missing conversation id.");
      if (!userId) throw new Error("You must be signed in to edit messages.");
      if (attachmentUrl) throw new Error("Cannot edit messages with attachments.");

      const nextBody = buildEditedMessageBody(currentBody, text) as Json;
      const parsed = parseMessageBody(nextBody);
      const messageType = allowedMessageTypes.has(
        parsed.type as Database["public"]["Enums"]["message_type"],
      )
        ? (parsed.type as Database["public"]["Enums"]["message_type"])
        : "text";

      const { data, error } = await supabase
        .from("messages")
        .update({
          body: nextBody,
          message_type: messageType,
          text: parsed.text.trim() ? parsed.text : null,
          client_id: parsed.clientId ?? null,
          meta: (parsed.meta ?? null) as Json,
        })
        .eq("id", messageId)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .select(MESSAGE_SELECT)
        .single();

      if (error) {
        console.error("[useEditMessage] Failed to edit message", error);
        throw new Error(error.message);
      }

      const updated = mapMessageRowToConversationMessage(data as MessageRow);

      return updated;
    },
    onSuccess: (updated) => {
      if (!conversationId) return;
      const messagesKey = conversationMessagesQueryKey(conversationId);
      queryClient.setQueryData<InfiniteData<ConversationMessagesPage>>(messagesKey, (existing) =>
        replaceMessageById(existing, updated),
      );
    },
  });
};
