import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostgrestSingleResponse, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import { mapMessageRowToConversationMessage, type ConversationMessage } from "./messageModel";

const messageSelect = "id, conversation_id, user_id, body, attachment_url, created_at" as const;

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

const mergeMessages = (
  existing: MessageRow[] | undefined,
  incoming: MessageRow | MessageRow[],
): MessageRow[] => {
  const incomingArray = Array.isArray(incoming) ? incoming : [incoming];
  const map = new Map<string, MessageRow>();

  for (const row of existing ?? []) {
    map.set(row.id, row);
  }

  for (const row of incomingArray) {
    map.set(row.id, row);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at ?? "").getTime() - new Date(b.created_at ?? "").getTime(),
  );
};

export const useConversationMessages = (conversationId: string | null) => {
  const queryClient = useQueryClient();

  const queryResult = useQuery<ConversationMessage[]>({
    queryKey: ["conversation", conversationId, "messages"],
    enabled: Boolean(conversationId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 15_000,
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error }: PostgrestSingleResponse<MessageRow[]> = await supabase
        .from("messages")
        .select(messageSelect)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[useConversationMessages] Failed to load messages", error);
        throw new Error(error.message);
      }

      const rows: MessageRow[] = mergeMessages([], data ?? []);
      return rows.map(mapMessageRowToConversationMessage);
    },
  });

  useEffect(() => {
    if (!conversationId) return undefined;

    const channel = supabase.channel(`conversation-messages-${conversationId}`);

    const upsertFromPayload = (payload: RealtimePostgresChangesPayload<MessageRow>) => {
      const row = payload.new;
      if (!row || row.conversation_id !== conversationId) return;

      queryClient.setQueryData<ConversationMessage[]>(
        ["conversation", conversationId, "messages"],
        (existing) => {
          const merged = mergeMessages(
            existing?.map((m) => ({
              id: m.id,
              conversation_id: m.conversationId,
              user_id: m.senderId,
              body: m.body,
              attachment_url: m.attachmentUrl,
              created_at: m.createdAt,
            })) ?? [],
            row,
          );

          return merged.map(mapMessageRowToConversationMessage);
        },
      );
    };

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        upsertFromPayload,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        upsertFromPayload,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return queryResult;
};
