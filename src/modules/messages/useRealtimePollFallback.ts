import { useCallback, useEffect, useRef, useState } from "react";

import type { ConversationRealtimeStatus } from "./conversationRealtimeManager";

const REALTIME_DOWN_STATUSES: ConversationRealtimeStatus[] = [
  "CHANNEL_ERROR",
  "TIMED_OUT",
  "CLOSED",
  "UNSUBSCRIBED",
];

const isRealtimeDown = (status: ConversationRealtimeStatus) =>
  REALTIME_DOWN_STATUSES.includes(status);

const DOWN_GRACE_MS = 3_000;

/**
 * Shared "realtime down -> poll" state helper.
 * Many hooks subscribe to the same conversation channel and need a consistent fallback.
 */
export const useRealtimePollFallback = (resetKey?: unknown) => {
  const [pollWhenRealtimeDown, setPollWhenRealtimeDown] = useState(false);
  const downTimeoutRef = useRef<number | null>(null);

  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (Object.is(prevResetKeyRef.current, resetKey)) return;
    prevResetKeyRef.current = resetKey;
    setPollWhenRealtimeDown(false);
    if (downTimeoutRef.current) {
      clearTimeout(downTimeoutRef.current);
      downTimeoutRef.current = null;
    }
  }, [resetKey]);

  const onStatus = useCallback((status: ConversationRealtimeStatus) => {
    const shouldPoll = isRealtimeDown(status);

    // When realtime drops into a terminal/error state, wait a brief grace window before polling.
    if (shouldPoll) {
      if (downTimeoutRef.current) return;
      downTimeoutRef.current = window.setTimeout(() => {
        downTimeoutRef.current = null;
        setPollWhenRealtimeDown(true);
      }, DOWN_GRACE_MS);
      return;
    }

    if (downTimeoutRef.current) {
      clearTimeout(downTimeoutRef.current);
      downTimeoutRef.current = null;
    }
    setPollWhenRealtimeDown(false);
  }, []);

  return { pollWhenRealtimeDown, onStatus } as const;
};
