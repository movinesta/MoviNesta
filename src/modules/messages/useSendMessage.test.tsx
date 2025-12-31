import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSendMessage } from "./useSendMessage";
import { conversationMessagesQueryKey } from "./queryKeys";
import type { InfiniteData } from "@tanstack/react-query";
import type { ConversationMessagesPage } from "./useConversationMessages";

const mockBlockStatus = vi.hoisted(() => ({ youBlocked: false, blockedYou: false }));
const mockMessageRow = {
  id: "msg-1",
  conversation_id: "conv-1",
  user_id: "user-1",
  body: "{}",
  attachment_url: null,
  created_at: "2024-01-01T00:00:00Z",
};

const mockSupabase = vi.hoisted(() => {
  const messageBuilder = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({ data: mockMessageRow, error: null })),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn(async () => ({ error: null })),
  };

  const blockedBuilder = {
    select: vi.fn().mockReturnThis(),
    or: vi.fn(async () => ({ data: [], error: null })),
  };

  const from = vi.fn((table: string) => {
    if (table === "blocked_users") return blockedBuilder;
    return messageBuilder;
  });

  return { from, messageBuilder, blockedBuilder };
});

vi.mock("@/lib/supabase", () => ({ supabase: mockSupabase }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("./useBlockStatus", () => ({
  fetchBlockStatus: vi.fn(async () => mockBlockStatus),
  useBlockStatus: vi.fn(),
}));

describe("useSendMessage", () => {
  beforeEach(() => {
    mockBlockStatus.youBlocked = false;
    mockBlockStatus.blockedYou = false;
    mockSupabase.from.mockClear();
    mockSupabase.messageBuilder.insert.mockClear();
    mockSupabase.messageBuilder.select.mockClear();
    mockSupabase.messageBuilder.single.mockClear();
    mockSupabase.messageBuilder.update.mockClear();
    mockSupabase.messageBuilder.eq.mockClear();
    mockSupabase.blockedBuilder.or.mockClear();
  });
  const createWrapper = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const QueryClientWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    QueryClientWrapper.displayName = "QueryClientWrapper";

    return { wrapper: QueryClientWrapper, client };
  };

  it("refuses to send when the other user has blocked you", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSendMessage("conv-1", { otherUserId: "other" }), {
      wrapper,
    });

    mockBlockStatus.blockedYou = true;

    await expect(
      result.current.mutateAsync({ text: "hello", attachmentPath: null }),
    ).rejects.toThrow("blocked you");
  });

  it("sends when no blocking relationship exists", async () => {
    mockBlockStatus.youBlocked = false;
    mockBlockStatus.blockedYou = false;

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSendMessage("conv-1", { otherUserId: "other" }), {
      wrapper,
    });

    const response = await result.current.mutateAsync({ text: "hey", attachmentPath: null });

    expect(response.id).toBe("msg-1");
    await waitFor(() => {
      expect(mockSupabase.messageBuilder.insert).toHaveBeenCalled();
    });
  });

  it("rejects empty messages without attachments", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSendMessage("conv-1", { otherUserId: "other" }), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({ text: "   \n\t  ", attachmentPath: null }),
    ).rejects.toThrow(/empty message/i);

    expect(mockSupabase.messageBuilder.insert).not.toHaveBeenCalled();
  });

  it("does not duplicate the optimistic message on send error", async () => {
    const { wrapper, client } = createWrapper();

    // Make the insert fail.
    mockSupabase.messageBuilder.single.mockImplementationOnce(
      async () =>
        ({
          data: null,
          error: { message: "Insert failed" },
        }) as any,
    );

    const { result } = renderHook(() => useSendMessage("conv-1", { otherUserId: "other" }), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({ text: "hello", attachmentPath: null }),
    ).rejects.toThrow();

    const cached = client.getQueryData(conversationMessagesQueryKey("conv-1")) as
      | InfiniteData<ConversationMessagesPage>
      | undefined;

    expect(cached).toBeDefined();
    expect(Array.isArray(cached?.pages)).toBe(true);
    const lastPage = cached?.pages?.[cached.pages.length - 1];
    const items = lastPage?.items ?? [];
    expect(items.length).toBe(1);
    expect(items[0]?.id).toMatch(/^temp-/);
  });
});
