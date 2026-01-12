import { describe, expect, it, vi, afterEach } from "vitest";
import { safeUpsertMessageRowIntoCache } from "./safeUpsertMessageRow";

const makeRow = (id: string) => ({
  id,
  conversation_id: "c1",
  user_id: "u1",
  created_at: new Date("2026-01-12T00:00:00.000Z").toISOString(),
  body: { text: "hi" },
  attachment_url: null,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("safeUpsertMessageRowIntoCache", () => {
  it("upserts immediately when cache update succeeds", () => {
    const store: { data: unknown } = { data: undefined };
    const queryClient = {
      setQueryData: vi.fn((_key: any, updater: any) => {
        store.data = updater(store.data);
      }),
      invalidateQueries: vi.fn(),
    };

    const ok = safeUpsertMessageRowIntoCache(
      queryClient as any,
      ["conversationMessages", "c1"],
      makeRow("m1") as any,
    );

    expect(ok).toBe(true);
    expect(queryClient.setQueryData).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("invalidates + retries when setQueryData throws", () => {
    vi.useFakeTimers();

    const store: { data: unknown } = { data: undefined };
    let calls = 0;
    const queryClient = {
      setQueryData: vi.fn((_key: any, updater: any) => {
        calls += 1;
        if (calls === 1) throw new Error("boom");
        store.data = updater(store.data);
      }),
      invalidateQueries: vi.fn(),
    };

    const ok = safeUpsertMessageRowIntoCache(
      queryClient as any,
      ["conversationMessages", "c1"],
      makeRow("m2") as any,
    );

    // Initial attempt failed, so we schedule retries and return false.
    expect(ok).toBe(false);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);

    // Three retries are scheduled; after running timers we should see 1 (initial) + 3 (retries).
    vi.runAllTimers();
    expect(queryClient.setQueryData).toHaveBeenCalledTimes(4);
  });

  it("can force a fail-once to exercise retry path even when setQueryData would succeed", () => {
    vi.useFakeTimers();

    const store: { data: unknown } = { data: undefined };
    const queryClient = {
      setQueryData: vi.fn((_key: any, updater: any) => {
        store.data = updater(store.data);
      }),
      invalidateQueries: vi.fn(),
    };

    const ok = safeUpsertMessageRowIntoCache(
      queryClient as any,
      ["conversationMessages", "c1"],
      makeRow("m_force") as any,
      { forceFailOnce: true },
    );

    expect(ok).toBe(false);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);

    vi.runAllTimers();
    // 1 initial attempt + 3 retries
    expect(queryClient.setQueryData).toHaveBeenCalledTimes(4);
  });

  it("does not retry after unmount", () => {
    vi.useFakeTimers();

    let calls = 0;
    const queryClient = {
      setQueryData: vi.fn(() => {
        calls += 1;
        throw new Error("boom");
      }),
      invalidateQueries: vi.fn(),
    };

    const isMountedRef = { current: false };
    safeUpsertMessageRowIntoCache(
      queryClient as any,
      ["conversationMessages", "c1"],
      makeRow("m3") as any,
      { isMountedRef },
    );

    vi.runAllTimers();
    expect(queryClient.setQueryData).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for invalid rows", () => {
    const queryClient = {
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    };
    const ok = safeUpsertMessageRowIntoCache(
      queryClient as any,
      ["conversationMessages", "c1"],
      null as any,
    );
    expect(ok).toBe(true);
    expect(queryClient.setQueryData).not.toHaveBeenCalled();
  });
});
