import type { MessageRow } from "./messageModel";
import { upsertMessageRowIntoPages } from "./conversationMessagesCache";

type QueryKey = unknown[];

export type QueryClientLike = {
  setQueryData: (queryKey: QueryKey, updater: (old: unknown) => unknown) => unknown;
  invalidateQueries?: (opts: { queryKey: QueryKey }) => unknown;
};

export type SafeUpsertOptions = {
  allowAppend?: boolean;
  /**
   * Debug/testing helper: forces the first updater attempt to throw (as if the cache shape was wrong)
   * so the invalidate+retry path can be exercised.
   */
  forceFailOnce?: boolean;
  /**
   * Guards scheduled retries from running after unmount.
   * Pass a ref-like object from React (e.g. { current: boolean }).
   */
  isMountedRef?: { current: boolean };
  /**
   * Injectable scheduler for tests.
   */
  schedule?: (fn: () => void, delayMs: number) => unknown;
};

/**
 * Defensive cache upsert helper.
 *
 * Why it exists:
 * - In rare race conditions, query cache shape can be transiently inconsistent.
 * - React Query's setQueryData updater can throw if provided data is unexpected.
 *
 * Behavior:
 * - Tries an upsert immediately.
 * - If it fails, invalidates the query and schedules a few retries.
 */
export function safeUpsertMessageRowIntoCache(
  queryClient: QueryClientLike,
  queryKey: QueryKey,
  row: MessageRow | null | undefined,
  options?: SafeUpsertOptions,
): boolean {
  if (!row || typeof row !== "object" || typeof (row as any).id !== "string") return true;

  const allowAppend = options?.allowAppend ?? true;
  const forceFailOnce = options?.forceFailOnce ?? false;
  const isMountedRef = options?.isMountedRef;
  const schedule =
    options?.schedule ??
    ((fn: () => void, delayMs: number) => {
      if (typeof window === "undefined" || typeof window.setTimeout !== "function") return;
      return window.setTimeout(fn, delayMs);
    });

  let forced = false;

  const tryOnce = (): boolean => {
    try {
      queryClient.setQueryData(queryKey, (old) => {
        if (forceFailOnce && !forced) {
          forced = true;
          throw new Error("forced cache updater failure");
        }
        return upsertMessageRowIntoPages(old as any, row as MessageRow, { allowAppend });
      });
      return true;
    } catch {
      return false;
    }
  };

  if (tryOnce()) return true;

  try {
    queryClient.invalidateQueries?.({ queryKey });
  } catch {
    // ignore
  }

  // Retry a few times with backoff (don't block the UI thread).
  const delays = [120, 400, 900];
  for (const d of delays) {
    schedule(() => {
      if (isMountedRef && !isMountedRef.current) return;
      tryOnce();
    }, d);
  }

  return false;
}
