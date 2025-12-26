import type { QueryClient } from "@tanstack/react-query";
import type { ConversationListItem } from "./useConversations";
import { conversationsQueryKey } from "./queryKeys";

export type ConversationListUpdater = (
  current: ConversationListItem,
) => ConversationListItem | null | undefined;

export type UpdateConversationListOptions = {
  /**
   * If true, moves the updated conversation to the top of the list.
   * Useful for "new message" effects.
   */
  moveToTop?: boolean;
};

/**
 * Pure helper for updating the conversations list cache.
 */
export const updateConversationList = (
  existing: unknown,
  conversationId: string,
  updater: ConversationListUpdater,
  options?: UpdateConversationListOptions,
): unknown => {
  if (!conversationId) return existing;
  if (!Array.isArray(existing)) return existing;

  const list = existing as ConversationListItem[];
  const idx = list.findIndex((c) => c.id === conversationId);
  if (idx < 0) return existing;

  const current = list[idx];
  const updated = updater(current);
  if (!updated || updated === current) return existing;

  // Avoid churn if the update is a no-op.
  const next = [...list];

  if (options?.moveToTop && idx > 0) {
    next.splice(idx, 1);
    next.unshift(updated);
    return next;
  }

  next[idx] = updated;
  return next;
};

export const updateConversationListItemInCache = (
  queryClient: QueryClient,
  conversationId: string,
  updater: ConversationListUpdater,
  options?: UpdateConversationListOptions,
): void => {
  queryClient.setQueriesData({ queryKey: conversationsQueryKey }, (existing: unknown) =>
    updateConversationList(existing, conversationId, updater, options),
  );
};
