import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ConversationRealtimeStatus } from "./conversationRealtimeManager";
import { useRealtimePollFallback } from "./useRealtimePollFallback";

describe("useRealtimePollFallback", () => {
  it("toggles polling when realtime goes down and recovers", () => {
    const { result } = renderHook(() => useRealtimePollFallback());

    expect(result.current.pollWhenRealtimeDown).toBe(false);

    act(() => result.current.onStatus("SUBSCRIBED"));
    expect(result.current.pollWhenRealtimeDown).toBe(false);

    act(() => result.current.onStatus("CHANNEL_ERROR"));
    expect(result.current.pollWhenRealtimeDown).toBe(true);

    act(() => result.current.onStatus("SUBSCRIBED"));
    expect(result.current.pollWhenRealtimeDown).toBe(false);
  });

  it("treats unknown statuses as down and avoids redundant flips", () => {
    const { result, rerender } = renderHook(({ resetKey }) => useRealtimePollFallback(resetKey), {
      initialProps: { resetKey: 1 },
    });

    act(() => result.current.onStatus("SOMETHING_NEW" as ConversationRealtimeStatus));
    expect(result.current.pollWhenRealtimeDown).toBe(true);

    act(() => result.current.onStatus("SOMETHING_NEW" as ConversationRealtimeStatus));
    expect(result.current.pollWhenRealtimeDown).toBe(true);

    rerender({ resetKey: 2 });
    expect(result.current.pollWhenRealtimeDown).toBe(false);

    act(() => result.current.onStatus("UNSUBSCRIBED"));
    expect(result.current.pollWhenRealtimeDown).toBe(true);
  });
});
