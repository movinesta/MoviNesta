import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  mapDeliveryReceiptRowToMessageDeliveryReceipt,
  mapReadReceiptRowToConversationReadReceipt,
  mapReactionRowToMessageReaction,
  type ConversationReadReceipt,
  type DeliveryReceiptRow,
  type MessageDeliveryReceipt,
  type MessageReaction,
  type MessageReactionRow,
  type ReadReceiptRow,
} from "./messageModel";

/**
 * Centralized Supabase fetchers for conversation-scoped message metadata (reactions/receipts).
 * Keeping the select/order clauses in one place reduces drift across hooks.
 */

export const fetchConversationReadReceipts = async (
  conversationId: string,
): Promise<ConversationReadReceipt[]> => {
  const { data, error } = await supabase
    .from("message_read_receipts")
    .select("user_id, conversation_id, last_read_at, last_read_message_id")
    .eq("conversation_id", conversationId)
    .order("last_read_at", { ascending: false })
    .returns<ReadReceiptRow[]>();

  if (error) {
    console.error("[useConversationReadReceipts] Failed to load", error);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapReadReceiptRowToConversationReadReceipt);
};

export const fetchConversationDeliveryReceipts = async (
  conversationId: string,
  messageIds: string[],
): Promise<MessageDeliveryReceipt[]> => {
  if (messageIds.length === 0) return [];

  const builder = supabase
    .from("message_delivery_receipts")
    .select("id, conversation_id, message_id, user_id, delivered_at, created_at")
    .eq("conversation_id", conversationId)
    .in("message_id", messageIds);

  const { data, error }: PostgrestSingleResponse<DeliveryReceiptRow[]> = await builder
    .order("created_at", { ascending: true })
    .returns<DeliveryReceiptRow[]>();

  if (error) {
    console.error("[useConversationDeliveryReceipts] Failed to load", error);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapDeliveryReceiptRowToMessageDeliveryReceipt);
};

export const fetchConversationReactions = async (
  conversationId: string,
): Promise<MessageReaction[]> => {
  const { data, error } = await supabase
    .from("message_reactions")
    .select("id, conversation_id, message_id, user_id, emoji, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<MessageReactionRow[]>();

  if (error) {
    console.error("[useConversationReactions] Failed to load reactions", error);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapReactionRowToMessageReaction);
};
