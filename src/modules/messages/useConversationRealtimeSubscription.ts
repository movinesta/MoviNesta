import { useEffect, type DependencyList } from "react";
import type { ConversationRealtimeHandlers } from "./conversationRealtimeManager";
import { subscribeConversationRealtime } from "./conversationRealtimeManager";

export const useConversationRealtimeSubscription = (
  conversationId: string | null,
  handlersFactory: () => ConversationRealtimeHandlers,
  deps: DependencyList,
) => {
  useEffect(() => {
    if (!conversationId) return undefined;
    return subscribeConversationRealtime(conversationId, handlersFactory());
  }, [conversationId, handlersFactory, ...deps]);
};
