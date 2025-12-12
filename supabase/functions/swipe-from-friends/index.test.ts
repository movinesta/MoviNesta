// supabase/functions/swipe-from-friends/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getUserClient, getAdminClient } from "../_shared/supabase.ts";
import { computeUserProfile } from "../_shared/preferences.ts";
import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("../_shared/supabase.ts", () => ({
  getUserClient: vi.fn(),
  getAdminClient: vi.fn(),
}));

vi.mock("../_shared/preferences.ts", () => ({
  computeUserProfile: vi.fn(),
}));

vi.mock("../_shared/swipe.ts", () => ({
  loadSeenTitleIdsForUser: vi.fn(),
}));

describe("swipe-from-friends handler", () => {
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
    };

    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockAdminClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "follows") {
          mockQueryBuilder.limit.mockResolvedValue({ data: [{ followed_id: "user-b" }], error: null });
        }
        if (table === "ratings") {
          mockQueryBuilder.limit.mockResolvedValue({ data: [{ title_id: "1", rating: 8 }], error: null });
        }
        if (table === "titles") {
          mockQueryBuilder.is.mockResolvedValue({ data: [{ title_id: "1", genres: ["Action"] }], error: null });
        }
        return mockQueryBuilder;
      }),
    };

    (getUserClient as vi.Mock).mockReturnValue(mockUserClient);
    (getAdminClient as vi.Mock).mockReturnValue(mockAdminClient);
    (loadSeenTitleIdsForUser as vi.Mock).mockResolvedValue(new Set());
    (computeUserProfile as vi.Mock).mockResolvedValue({});
  });

  it("should return a deck based on friends' ratings", async () => {
    await import("./index.ts");
    const handler = (serve as vi.Mock).mock.calls[0][0];
    const req = new Request("http://example.com/swipe-from-friends");
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.cards.length).toBe(1);
    expect(json.cards[0].title_id).toBe("1");
  });
});
