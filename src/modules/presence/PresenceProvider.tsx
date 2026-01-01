import * as React from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth/AuthProvider";

export type PresenceStatus = "online" | "away" | "offline";

type PresenceMeta = {
  user_id: string;
  last_seen: number; // epoch ms
  status?: "online" | "away";
};

type PresenceState = Record<string, PresenceMeta[]>;

type PresenceSnapshot = Record<
  string,
  {
    last_seen: number | null;
    status: PresenceStatus;
  }
>;

type PresenceContextValue = {
  /** Returns the computed status for a user id. */
  getStatus: (userId: string) => PresenceStatus;
  /** Returns the last_seen timestamp (epoch ms) if known. */
  getLastSeen: (userId: string) => number | null;
  /** Full computed snapshot for UI lists, debugging, etc. */
  snapshot: PresenceSnapshot;
};

const PresenceContext = React.createContext<PresenceContextValue | null>(null);

const ONLINE_TTL_MS = 45_000; // if last_seen within 45s
const AWAY_TTL_MS = 2 * 60_000; // else away up to 2m
const HEARTBEAT_MS = 20_000;
const DB_TOUCH_MIN_INTERVAL_MS = 60_000; // keep DB writes light

function computeSnapshot(state: PresenceState): PresenceSnapshot {
  const now = Date.now();
  const snapshot: PresenceSnapshot = {};

  for (const metas of Object.values(state)) {
    for (const meta of metas ?? []) {
      const userId = meta?.user_id;
      if (!userId) continue;

      const prev = snapshot[userId];
      const lastSeen = typeof meta.last_seen === "number" ? meta.last_seen : null;

      if (!prev || (lastSeen ?? 0) > (prev.last_seen ?? 0)) {
        snapshot[userId] = {
          last_seen: lastSeen,
          status: "offline",
        };
      }
    }
  }

  // Derive status from timestamps (and optionally meta.status in the future)
  for (const [userId, entry] of Object.entries(snapshot)) {
    const lastSeen = entry.last_seen;
    if (lastSeen == null) {
      entry.status = "offline";
      continue;
    }

    const age = now - lastSeen;
    if (age <= ONLINE_TTL_MS) entry.status = "online";
    else if (age <= AWAY_TTL_MS) entry.status = "away";
    else entry.status = "offline";

    snapshot[userId] = entry;
  }

  return snapshot;
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const statusRef = React.useRef<"online" | "away">("online");
  const lastDbTouchRef = React.useRef(0);

  const [snapshot, setSnapshot] = React.useState<PresenceSnapshot>({});
  const lastPresenceStateRef = React.useRef<PresenceState>({});

  const recomputeSnapshot = React.useCallback(() => {
    // Presence status is time-based (ONLINE_TTL_MS / AWAY_TTL_MS). Even if the
    // underlying presence state hasn't changed, we need to periodically recompute.
    setSnapshot(computeSnapshot(lastPresenceStateRef.current));
  }, []);

  const touchDbLastSeen = React.useCallback(async () => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - lastDbTouchRef.current < DB_TOUCH_MIN_INTERVAL_MS) return;
    lastDbTouchRef.current = now;

    // Best-effort persistence so we can show "Last active" even when the user is offline.
    // Requires the `profiles.last_seen_at` column (see migration).
    try {
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date(now).toISOString() } as any)
        .eq("id", user.id);
    } catch {
      // ignore
    }
  }, [user?.id]);

  const trackNow = React.useCallback(async () => {
    const ch = channelRef.current;
    if (!ch || !user?.id) return;

    try {
      await ch.track({
        user_id: user.id,
        last_seen: Date.now(),
        status: statusRef.current,
      } satisfies PresenceMeta);
    } catch {
      // Presence updates are best-effort.
    }

    // Immediately refresh our local snapshot from the channel state.
    try {
      const state = ch.presenceState() as unknown as PresenceState;
      lastPresenceStateRef.current = state;
      setSnapshot(computeSnapshot(state));
    } catch {
      // ignore
    }

    // Persist last_seen_at periodically.
    touchDbLastSeen();
  }, [touchDbLastSeen, user?.id]);

  React.useEffect(() => {
    if (!user?.id) {
      // Ensure we reset if user signs out.
      setSnapshot({});
      return;
    }

    const channel = supabase.channel("presence:global", {
      config: {
        presence: { key: user.id },
      },
    });

    channelRef.current = channel;

    const sync = () => {
      try {
        const state = channel.presenceState() as unknown as PresenceState;
        lastPresenceStateRef.current = state;
        setSnapshot(computeSnapshot(state));
      } catch {
        // ignore
      }
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync);

    const sub = channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Track immediately on subscribe.
        trackNow();

        // Ensure we compute at least once even if a sync event isn't emitted.
        sync();
        window.setTimeout(sync, 150);
      }
    });

    const onVisibility = () => {
      const next: "online" | "away" = document.visibilityState === "visible" ? "online" : "away";
      if (statusRef.current === next) return;
      statusRef.current = next;
      trackNow();
    };

    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      trackNow();
    }, HEARTBEAT_MS);

    const tick = window.setInterval(() => {
      recomputeSnapshot();
    }, 5_000);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);

      try {
        // Unsubscribe channel
        sub.unsubscribe?.();
      } catch {
        // ignore
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = null;
    };
  }, [recomputeSnapshot, trackNow, user?.id]);

  const getLastSeen = React.useCallback(
    (userId: string) => {
      return snapshot[userId]?.last_seen ?? null;
    },
    [snapshot],
  );

  const getStatus = React.useCallback(
    (userId: string): PresenceStatus => {
      return snapshot[userId]?.status ?? "offline";
    },
    [snapshot],
  );

  const value = React.useMemo<PresenceContextValue>(
    () => ({ getStatus, getLastSeen, snapshot }),
    [getLastSeen, getStatus, snapshot],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence(): PresenceContextValue {
  const ctx = React.useContext(PresenceContext);
  if (!ctx) {
    return {
      getStatus: () => "offline",
      getLastSeen: () => null,
      snapshot: {},
    };
  }
  return ctx;
}
