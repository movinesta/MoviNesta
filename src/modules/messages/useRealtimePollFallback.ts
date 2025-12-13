import { useCallback, useEffect, useState } from "react";

import type { ConversationRealtimeStatus } from "./conversationRealtimeManager";

const REALTIME_DOWN_STATUSES: ConversationRealtimeStatus[] = [
  "CHANNEL_ERROR",
  "TIMED_OUT",
  "CLOSED",
  "UNSUBSCRIBED",
];

const isRealtimeDown = (status: ConversationRealtimeStatus) =>
  REALTIME_DOWN_STATUSES.includes(status) || status !== "SUBSCRIBED";

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
    // Treat any non-subscribed terminal/errored state as "down" and avoid redundant state flips.
    setPollWhenRealtimeDown((prev) => {
      const shouldPoll = isRealtimeDown(status);
      return prev === shouldPoll ? prev : shouldPoll;
    });
  }, []);

  return { pollWhenRealtimeDown, onStatus } as const;
};
