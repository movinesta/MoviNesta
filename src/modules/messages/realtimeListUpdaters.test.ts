import { describe, expect, it } from "vitest";

import {
  createConversationScopedUpsertIntoListHandler,
  createRealtimeDeleteFromListHandler,
} from "./realtimeListUpdaters";

describe("realtimeListUpdaters", () => {
  it("upserts a mapped row into list when conversation_id matches", () => {
    const queryKey = ["k"] as const;
    let state: Array<{ id: string; n: number }> | undefined = undefined;

    const queryClient = {
      setQueryData: (_key: unknown, updater: any) => {
        state = updater(state);
      },
    } as any;

    const handler = createConversationScopedUpsertIntoListHandler<
      { id: string; conversation_id: string; n: number },
      { id: string; n: number }
    >({
      conversationId: "c1",
      queryClient,
      queryKey,
      mapRow: (row) => ({ id: row.id, n: row.n }),
      key: (x) => x.id,
      sort: (a, b) => a.n - b.n,
    });

    handler({ new: { id: "b", conversation_id: "c1", n: 2 } } as any);
    handler({ new: { id: "a", conversation_id: "c1", n: 1 } } as any);

    expect(state).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ]);
  });

  it("does nothing when conversation_id does not match", () => {
    const queryKey = ["k"] as const;
    let state: Array<{ id: string; n: number }> | undefined = undefined;

    const queryClient = {
      setQueryData: (_key: unknown, updater: any) => {
        state = updater(state);
      },
    } as any;

    const handler = createConversationScopedUpsertIntoListHandler<
      { id: string; conversation_id: string; n: number },
      { id: string; n: number }
    >({
      conversationId: "c1",
      queryClient,
      queryKey,
      mapRow: (row) => ({ id: row.id, n: row.n }),
      key: (x) => x.id,
    });

    handler({ new: { id: "a", conversation_id: "c2", n: 1 } } as any);
    expect(state).toBeUndefined();
  });

  it("deletes by id and invalidates when id is missing", () => {
    const queryKey = ["k"] as const;
    let state: Array<{ id: string; n: number }> | undefined = [
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ];
    let invalidated = false;

    const queryClient = {
      setQueryData: (_key: unknown, updater: any) => {
        state = updater(state);
      },
      invalidateQueries: (_args: any) => {
        invalidated = true;
      },
    } as any;

    const handler = createRealtimeDeleteFromListHandler<{ id: string }, { id: string; n: number }>({
      queryClient,
      queryKey,
      key: (x) => x.id,
    });

    handler({ old: { id: "a" } } as any);
    expect(state).toEqual([{ id: "b", n: 2 }]);

    handler({ old: {} } as any);
    expect(invalidated).toBe(true);
  });
});
