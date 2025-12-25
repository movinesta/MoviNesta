/**
 * Shared React Query defaults used by conversations + realtime-backed lists.
 * Keeping these constants in one place reduces drift across hooks.
 *
 * NOTE: Some Supabase setups can report a healthy realtime channel ("SUBSCRIBED")
 * while Postgres change events are not delivered (e.g., table replication not enabled).
 * To keep the app functional in those cases, we always poll at a low frequency and
 * poll faster when realtime errors/timeouts are detected.
 */

export const REALTIME_POLL_INTERVAL_DOWN_MS = 2_000;

/**
 * For realtime-backed data, we treat items as "fresh" for a short window.
 * This helps avoid immediate refetch loops when navigating back/forth.
 */
export const REALTIME_STALE_TIME_MS = 15_000;

export const realtimeRefetchOptions = (pollWhenRealtimeDown: boolean) => ({
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  // Only poll when realtime is unhealthy.
  refetchInterval: (pollWhenRealtimeDown ? REALTIME_POLL_INTERVAL_DOWN_MS : false) as
    | number
    | false,
  refetchIntervalInBackground: false,
});
