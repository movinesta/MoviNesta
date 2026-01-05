import { useMemo } from "react";

import type { ConversationMessage } from "./messageModel";
import { getMessageMeta } from "./messageText";

/**
 * Returns the last *visible* outgoing message id (i.e. sent by the current user)
 * that is not marked as deleted.
 */
export function useLastVisibleOwnMessageId(args: {
  messages: ConversationMessage[] | undefined;
  currentUserId: string | null;
  hiddenMessageIds: Record<string, boolean>;
}): string | null {
  const { messages, currentUserId, hiddenMessageIds } = args;

  return useMemo(() => {
    if (!messages || !currentUserId) return null;

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (hiddenMessageIds[m.id]) continue;
      if (m.senderId !== currentUserId) continue;

      const meta = getMessageMeta(m.body);
      if (meta.deleted) continue;
      return m.id;
    }

    return null;
  }, [hiddenMessageIds, messages, currentUserId]);
}
