import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { mapMessageRowToConversationMessage, type MessageRow } from "./messageModel";
import type { ConversationMessagesPage } from "./useConversationMessages";
import { conversationMessagesQueryKey, conversationsQueryKey } from "./queryKeys";
import { replaceMessageById } from "./conversationMessagesCache";
import { removeChatMediaFile } from "./chatMediaStorage";
import { MESSAGE_SELECT } from "./messageSelect";

/**
 * Soft-delete a message: replaces body with a system payload and clears attachment_url.
 */
export const useDeleteMessage = (conversationId: string | null) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      attachmentUrl,
    }: {
      messageId: string;
      attachmentUrl?: string | null;
    }) => {
      if (!conversationId) throw new Error("Missing conversation id.");
      if (!userId) throw new Error("You must be signed in to delete messages.");

      const deletedAt = new Date().toISOString();
      const bodyPayload = {
        type: "system",
        text: "",
        deleted: true,
        deletedAt,
      };

      const nextBody = JSON.stringify(bodyPayload);

      const { data, error } = await supabase
        .from("messages")
        .update({
          body: nextBody,
          attachment_url: null,
        })
        .eq("id", messageId)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .select(MESSAGE_SELECT)
        .single();

      if (error) {
        console.error("[useDeleteMessage] Failed to delete message", error);
        throw new Error(error.message);
      }

      if (attachmentUrl) {
        try {
          await removeChatMediaFile(attachmentUrl);
        } catch (err) {
          console.warn("[useDeleteMessage] Deleted message but failed to remove attachment", err);
        }
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

      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });
};
