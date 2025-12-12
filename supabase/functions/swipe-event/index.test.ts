// supabase/functions/swipe-event/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";
import { getUserClient, getAdminClient } from "../_shared/supabase.ts";

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  SupabaseClient: vi.fn(),
}));

vi.mock("../_shared/supabase.ts", () => ({
  getUserClient: vi.fn(),
  getAdminClient: vi.fn(),
}));

describe("swipe-event handler", () => {
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
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { content_type: "movie" },
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    mockAdminClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    (getUserClient as vi.Mock).mockReturnValue(mockUserClient);
    (getAdminClient as vi.Mock).mockReturnValue(mockAdminClient);
  });

  it("should process a 'like' swipe", async () => {
    const req = new Request("http://example.com/swipe-event", {
      method: "POST",
      body: JSON.stringify({
        titleId: "00000000-0000-0000-0000-000000000000",
        direction: "like",
      }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mockUserClient.upsert).toHaveBeenCalledTimes(2); // ratings and library_entries
    expect(mockUserClient.insert).toHaveBeenCalledTimes(1); // activity_events
  });
});
