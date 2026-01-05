import { useCallback, useEffect, useRef, useState } from "react";

import type { ConversationRealtimeStatus } from "./conversationRealtimeManager";

const REALTIME_OK_STATUSES = new Set<ConversationRealtimeStatus>(["SUBSCRIBED"]);

const isRealtimeDown = (status: ConversationRealtimeStatus) => !REALTIME_OK_STATUSES.has(status);

/**
 * Shared "realtime down -> poll" state helper.
 * Many hooks subscribe to the same conversation channel and need a consistent fallback.
 */
export const useRealtimePollFallback = (resetKey?: unknown) => {
  const [pollWhenRealtimeDown, setPollWhenRealtimeDown] = useState(false);

  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (Object.is(prevResetKeyRef.current, resetKey)) return;
    prevResetKeyRef.current = resetKey;
    setPollWhenRealtimeDown(false);
  }, [resetKey]);

  const onStatus = useCallback((status: ConversationRealtimeStatus) => {
    const shouldPoll = isRealtimeDown(status);
    setPollWhenRealtimeDown((prev) => (prev === shouldPoll ? prev : shouldPoll));
  }, []);

  return { pollWhenRealtimeDown, onStatus } as const;
};
