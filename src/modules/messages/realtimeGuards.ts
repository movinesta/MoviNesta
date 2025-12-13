import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Supabase realtime payload types are optimistic.
 * At runtime, payload.new / payload.old can be empty objects or null depending on event.
 */
export const getRealtimeNewRow = <T>(payload: RealtimePostgresChangesPayload<T>): unknown =>
  (payload as unknown as { new: unknown }).new;

export const getRealtimeOldRow = <T>(payload: RealtimePostgresChangesPayload<T>): unknown =>
  (payload as unknown as { old: unknown }).old;

export const getStringField = (row: unknown, key: string): string | null => {
  if (!isRecord(row)) return null;
  const value = row[key];
  return typeof value === "string" ? value : null;
};

export const hasConversationId = (row: unknown, conversationId: string): boolean =>
  getStringField(row, "conversation_id") === conversationId;
