import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import { mapMessageRowToConversationMessage } from "./messageModel";

const messageSelect = "id, conversation_id, user_id, body, attachment_url, created_at" as const;

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export const useConversationMessages = (conversationId: string | null) => {
  return useQuery({
    queryKey: ["conversation", conversationId, "messages"],
    enabled: Boolean(conversationId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: conversationId ? 6000 : false,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("messages")
        .select(messageSelect)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[useConversationMessages] Failed to load messages", error);
        throw new Error(error.message);
      }

      const rows: MessageRow[] = data ?? [];
      return rows.map(mapMessageRowToConversationMessage);
    },
  });
};
