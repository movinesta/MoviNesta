import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const TYPING_INACTIVITY_MS = 3000;
const TYPING_HEARTBEAT_MS = 2000;
const REMOTE_TYPING_TTL_MS = 5000;

type TypingBroadcastPayload = {
  userId: string;
  displayName: string;
  isTyping: boolean;
};

export const useTypingChannel = (params: {
  conversationId: string | null;
  userId: string | null;
  displayName: string | null;
}) => {
  const { conversationId, userId, displayName } = params;

  // Track by userId to avoid collisions; map to displayName for UI.
  const [remoteTypingById, setRemoteTypingById] = useState<Record<string, string>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const remoteTimeoutsRef = useRef<Map<string, number>>(new Map());

  const localStateRef = useRef<{ isTyping: boolean; timeoutId: number | null; lastSentAtMs: number }>({
    isTyping: false,
    timeoutId: null,
    lastSentAtMs: 0,
  });

  const broadcastTyping = useCallback(
    async (isTyping: boolean) => {
      if (!conversationId || !userId || !displayName) return;
      const channel = channelRef.current;
      if (!channel) return;

      await channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId,
          displayName,
          isTyping,
        } satisfies TypingBroadcastPayload,
      });
    },
    [conversationId, userId, displayName],
  );

  const stopTyping = useCallback(async () => {
    if (localStateRef.current.timeoutId != null) {
      window.clearTimeout(localStateRef.current.timeoutId);
      localStateRef.current.timeoutId = null;
    }
    if (!localStateRef.current.isTyping) return;
    localStateRef.current.isTyping = false;
    localStateRef.current.lastSentAtMs = 0;
    await broadcastTyping(false);
  }, [broadcastTyping]);

  const noteLocalInputActivity = useCallback(
    (hasMeaningfulText: boolean) => {
      if (!conversationId || !userId || !displayName) return;
      const channel = channelRef.current;
      if (!channel) return;

      const wasTyping = localStateRef.current.isTyping;
      if (hasMeaningfulText) {
        const now = Date.now();

        if (!wasTyping) {
          localStateRef.current.isTyping = true;
          localStateRef.current.lastSentAtMs = now;
          void broadcastTyping(true);
        } else if (now - localStateRef.current.lastSentAtMs > TYPING_HEARTBEAT_MS) {
          localStateRef.current.lastSentAtMs = now;
          void broadcastTyping(true);
        }

        if (localStateRef.current.timeoutId != null) {
          window.clearTimeout(localStateRef.current.timeoutId);
        }
        localStateRef.current.timeoutId = window.setTimeout(() => {
          localStateRef.current.isTyping = false;
          localStateRef.current.lastSentAtMs = 0;
          localStateRef.current.timeoutId = null;
          void broadcastTyping(false);
        }, TYPING_INACTIVITY_MS);
        return;
      }

      // Empty input: if we were typing, send stop.
      if (wasTyping) {
        void stopTyping();
      }
    },
    [broadcastTyping, conversationId, displayName, stopTyping, userId],
  );

  // Subscribe
  useEffect(() => {
    if (!conversationId) return undefined;

    const channel = supabase.channel(`supabase_realtime_typing:conversation:${conversationId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const data = payload as Partial<TypingBroadcastPayload> | null;
        if (!data?.userId) return;
        // Ignore self
        if (userId && data.userId === userId) return;

        setRemoteTypingById((current) => {
          const next = { ...current };
          if (data.isTyping && data.displayName) {
            next[data.userId!] = data.displayName;
          } else {
            delete next[data.userId!];
          }
          return next;
        });

        const existingTimeout = remoteTimeoutsRef.current.get(data.userId);
        if (existingTimeout != null) {
          window.clearTimeout(existingTimeout);
        }

        if (data.isTyping) {
          const timeoutId = window.setTimeout(() => {
            setRemoteTypingById((current) => {
              const next = { ...current };
              delete next[data.userId!];
              return next;
            });
            remoteTimeoutsRef.current.delete(data.userId!);
          }, REMOTE_TYPING_TTL_MS);

          remoteTimeoutsRef.current.set(data.userId!, timeoutId);
        } else {
          remoteTimeoutsRef.current.delete(data.userId);
        }
      })
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void stopTyping();
      }
    };

    const handleBeforeUnload = () => {
      // best-effort stop typing
      void stopTyping();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    window.addEventListener("blur", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      window.removeEventListener("blur", handleBeforeUnload);

      remoteTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      remoteTimeoutsRef.current.clear();

      void stopTyping();

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, stopTyping, userId]);

  const remoteTypingUsers = useMemo(() => Object.values(remoteTypingById), [remoteTypingById]);

  return {
    remoteTypingUsers,
    noteLocalInputActivity,
    stopTyping,
  } as const;
};
