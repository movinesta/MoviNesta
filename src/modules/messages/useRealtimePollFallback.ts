import { useCallback, useEffect, useState } from "react";

import type { ConversationRealtimeStatus } from "./conversationRealtimeManager";

/**
 * Shared "realtime down -> poll" state helper.
 * Many hooks subscribe to the same conversation channel and need a consistent fallback.
 */
export const useRealtimePollFallback = (resetKey?: unknown) => {
  const [pollWhenRealtimeDown, setPollWhenRealtimeDown] = useState(false);

  useEffect(() => {
    setPollWhenRealtimeDown(false);
  }, [resetKey]);

  const onStatus = useCallback((status: ConversationRealtimeStatus) => {
    // Supabase statuses include: "SUBSCRIBED", "TIMED_OUT", "CLOSED", "CHANNEL_ERROR".
    // Treat any non-subscribed terminal/errored state as "down".
    if (status === "SUBSCRIBED") {
      setPollWhenRealtimeDown(false);
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      setPollWhenRealtimeDown(true);
    }
  }, []);

  return { pollWhenRealtimeDown, onStatus } as const;
};
