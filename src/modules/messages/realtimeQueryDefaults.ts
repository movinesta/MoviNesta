/**
 * Shared React Query defaults used by conversations + realtime-backed lists.
 * Keeping these constants in one place reduces drift across hooks.
 *
 * NOTE: Some Supabase setups can report a healthy realtime channel ("SUBSCRIBED")
 * while Postgres change events are not delivered (e.g., table replication not enabled).
 * To keep the app functional in those cases, we always poll at a low frequency and
 * poll faster when realtime errors/timeouts are detected.
 */

// We poll slowly even when the channel reports "SUBSCRIBED" because it's common for
// Postgres change events to be missing (e.g., table replication not enabled). This keeps
// the UI feeling "live" without requiring the user to reload.
// Messages should feel "instant" even when realtime delivery is flaky.
// Keep a short poll interval while the user is on a conversation.
export const REALTIME_POLL_INTERVAL_OK_MS = 5_000;

export const REALTIME_POLL_INTERVAL_DOWN_MS = 1_500;

/**
 * For realtime-backed data, we treat items as "fresh" for a short window.
 * This helps avoid immediate refetch loops when navigating back/forth.
 */
export const REALTIME_STALE_TIME_MS = 5_000;

export const realtimeRefetchOptions = (pollWhenRealtimeDown: boolean) => ({
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  // Poll slowly when realtime looks healthy; poll faster when it isn't.
  refetchInterval: (pollWhenRealtimeDown
    ? REALTIME_POLL_INTERVAL_DOWN_MS
    : REALTIME_POLL_INTERVAL_OK_MS) as number,
  refetchIntervalInBackground: false,
});
