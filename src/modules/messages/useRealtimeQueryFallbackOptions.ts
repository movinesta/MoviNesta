import { realtimeRefetchOptions } from "./realtimeQueryDefaults";
import { useRealtimePollFallback } from "./useRealtimePollFallback";

/**
 * Convenience wrapper for realtime-backed React Query hooks.
 * - Tracks realtime status and toggles polling fallback when the channel errors.
 * - Provides shared refetch options consistent across hooks.
 */
export const useRealtimeQueryFallbackOptions = (resetKey?: unknown) => {
  const { pollWhenRealtimeDown, onStatus: onRealtimeStatus } = useRealtimePollFallback(resetKey);

  return {
    pollWhenRealtimeDown,
    onRealtimeStatus,
    refetchOptions: realtimeRefetchOptions(pollWhenRealtimeDown),
  } as const;
};
