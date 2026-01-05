import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type {
  DeliveryReceiptRow,
  MessageReactionRow,
  MessageRow,
  ReadReceiptRow,
} from "./messageModel";

/**
 * Shared realtime channel manager.
 *
 * Problem: multiple hooks were each creating their own Supabase realtime channel for the same
 * conversation, multiplying websocket subscriptions and handlers.
 *
 * Solution: maintain a single per-conversation channel and fan out events to registered listeners.
 * Hooks register/unregister listeners; the underlying channel is created once and cleaned up when
 * the last listener is removed.
 */

export type ConversationRealtimeStatus = string;

export type ConversationRealtimeHandlers = {
  onStatus?: (status: ConversationRealtimeStatus) => void;

  onMessageInsert?: (payload: RealtimePostgresChangesPayload<MessageRow>) => void;
  onMessageUpdate?: (payload: RealtimePostgresChangesPayload<MessageRow>) => void;

  onReadReceiptUpsert?: (payload: RealtimePostgresChangesPayload<ReadReceiptRow>) => void;
  onDeliveryReceiptUpsert?: (payload: RealtimePostgresChangesPayload<DeliveryReceiptRow>) => void;

  onReactionUpsert?: (payload: RealtimePostgresChangesPayload<MessageReactionRow>) => void;
  onReactionDelete?: (payload: RealtimePostgresChangesPayload<MessageReactionRow>) => void;
};

type Entry = {
  conversationId: string;
  channel: RealtimeChannel;
  refCount: number;
  lastStatus: ConversationRealtimeStatus | null;

  statusListeners: Set<NonNullable<ConversationRealtimeHandlers["onStatus"]>>;

  messageInsertListeners: Set<NonNullable<ConversationRealtimeHandlers["onMessageInsert"]>>;
  messageUpdateListeners: Set<NonNullable<ConversationRealtimeHandlers["onMessageUpdate"]>>;

  readReceiptUpsertListeners: Set<NonNullable<ConversationRealtimeHandlers["onReadReceiptUpsert"]>>;
  deliveryReceiptUpsertListeners: Set<
    NonNullable<ConversationRealtimeHandlers["onDeliveryReceiptUpsert"]>
  >;

  reactionUpsertListeners: Set<NonNullable<ConversationRealtimeHandlers["onReactionUpsert"]>>;
  reactionDeleteListeners: Set<NonNullable<ConversationRealtimeHandlers["onReactionDelete"]>>;
};

const entries = new Map<string, Entry>();

const ensureEntry = (conversationId: string): Entry => {
  const existing = entries.get(conversationId);
  if (existing) return existing;

  const channel = supabase.channel(`conversation-db-${conversationId}`);

  const entry: Entry = {
    conversationId,
    channel,
    refCount: 0,
    lastStatus: null,

    statusListeners: new Set(),

    messageInsertListeners: new Set(),
    messageUpdateListeners: new Set(),

    readReceiptUpsertListeners: new Set(),
    deliveryReceiptUpsertListeners: new Set(),

    reactionUpsertListeners: new Set(),
    reactionDeleteListeners: new Set(),
  };

  // Messages
  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const typed = payload as RealtimePostgresChangesPayload<MessageRow>;
        for (const cb of entry.messageInsertListeners) cb(typed);
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
        const typed = payload as RealtimePostgresChangesPayload<MessageRow>;
        for (const cb of entry.messageUpdateListeners) cb(typed);
      },
    )
    // Read receipts
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_read_receipts",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const typed = payload as RealtimePostgresChangesPayload<ReadReceiptRow>;
        for (const cb of entry.readReceiptUpsertListeners) cb(typed);
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
      (payload) => {
        const typed = payload as RealtimePostgresChangesPayload<ReadReceiptRow>;
        for (const cb of entry.readReceiptUpsertListeners) cb(typed);
      },
    )
    // Delivery receipts
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_delivery_receipts",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const typed = payload as RealtimePostgresChangesPayload<DeliveryReceiptRow>;
        for (const cb of entry.deliveryReceiptUpsertListeners) cb(typed);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "message_delivery_receipts",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const typed = payload as RealtimePostgresChangesPayload<DeliveryReceiptRow>;
        for (const cb of entry.deliveryReceiptUpsertListeners) cb(typed);
      },
    )
    // Reactions
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_reactions",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const typed = payload as RealtimePostgresChangesPayload<MessageReactionRow>;
        for (const cb of entry.reactionUpsertListeners) cb(typed);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "message_reactions",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const typed = payload as RealtimePostgresChangesPayload<MessageReactionRow>;
        for (const cb of entry.reactionUpsertListeners) cb(typed);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "message_reactions",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const typed = payload as RealtimePostgresChangesPayload<MessageReactionRow>;
        for (const cb of entry.reactionDeleteListeners) cb(typed);
      },
    );

  // Subscribe once.
  channel.subscribe((status) => {
    const typedStatus = status as ConversationRealtimeStatus;
    entry.lastStatus = typedStatus;
    for (const cb of entry.statusListeners) cb(typedStatus);
  });

  entries.set(conversationId, entry);
  return entry;
};

/**
 * Register for realtime updates for a conversation.
 *
 * Returns a cleanup function that MUST be called (typically from useEffect cleanup).
 */
export const subscribeConversationRealtime = (
  conversationId: string,
  handlers: ConversationRealtimeHandlers,
): (() => void) => {
  const entry = ensureEntry(conversationId);
  entry.refCount += 1;

  const added: Array<() => void> = [];

  if (handlers.onStatus) {
    entry.statusListeners.add(handlers.onStatus);
    added.push(() => entry.statusListeners.delete(handlers.onStatus!));
    if (entry.lastStatus) {
      // Give late subscribers a best-effort current status.
      handlers.onStatus(entry.lastStatus);
    }
  }

  if (handlers.onMessageInsert) {
    entry.messageInsertListeners.add(handlers.onMessageInsert);
    added.push(() => entry.messageInsertListeners.delete(handlers.onMessageInsert!));
  }
  if (handlers.onMessageUpdate) {
    entry.messageUpdateListeners.add(handlers.onMessageUpdate);
    added.push(() => entry.messageUpdateListeners.delete(handlers.onMessageUpdate!));
  }

  if (handlers.onReadReceiptUpsert) {
    entry.readReceiptUpsertListeners.add(handlers.onReadReceiptUpsert);
    added.push(() => entry.readReceiptUpsertListeners.delete(handlers.onReadReceiptUpsert!));
  }
  if (handlers.onDeliveryReceiptUpsert) {
    entry.deliveryReceiptUpsertListeners.add(handlers.onDeliveryReceiptUpsert);
    added.push(() =>
      entry.deliveryReceiptUpsertListeners.delete(handlers.onDeliveryReceiptUpsert!),
    );
  }

  if (handlers.onReactionUpsert) {
    entry.reactionUpsertListeners.add(handlers.onReactionUpsert);
    added.push(() => entry.reactionUpsertListeners.delete(handlers.onReactionUpsert!));
  }
  if (handlers.onReactionDelete) {
    entry.reactionDeleteListeners.add(handlers.onReactionDelete);
    added.push(() => entry.reactionDeleteListeners.delete(handlers.onReactionDelete!));
  }

  return () => {
    for (const remove of added) remove();

    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      try {
        supabase.removeChannel(entry.channel);
      } catch {
        // ignore
      }
      entries.delete(conversationId);
    }
  };
};
