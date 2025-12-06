// supabase/functions/create-direct-conversation/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";
import { getUserClient, getAdminClient } from "../_shared/supabase.ts";

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("../_shared/supabase.ts", () => ({
  getUserClient: vi.fn(),
  getAdminClient: vi.fn(),
}));

describe("create-direct-conversation handler", () => {
  let mockUserClient: any;
  let mockAdminClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-a" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockAdminClient = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "convo-123" },
        error: null,
      }),
    };
    (getUserClient as vi.Mock).mockReturnValue(mockUserClient);
    (getAdminClient as vi.Mock).mockReturnValue(mockAdminClient);
  });

  it("should create a new conversation", async () => {
    const req = new Request("http://example.com/create-direct-conversation", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "user-b" }),
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.conversationId).toBe("convo-123");
    expect(mockAdminClient.upsert).toHaveBeenCalledTimes(2); // Once for conversation, once for participants
  });

  it("should return an error if the target user is blocked", async () => {
    mockUserClient.or.mockResolvedValue({
      data: [{ blocker_id: "user-a", blocked_id: "user-b" }],
      error: null,
    });

    const req = new Request("http://example.com/create-direct-conversation", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "user-b" }),
    });

    const res = await handler(req);
    expect(res.status).toBe(403);
  });
});
