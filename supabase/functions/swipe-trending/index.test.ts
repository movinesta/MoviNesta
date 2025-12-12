// supabase/functions/swipe-trending/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";
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
  getPreferredContentType: vi.fn(),
}));

vi.mock("../_shared/swipe.ts", () => ({
  loadSeenTitleIdsForUser: vi.fn(),
}));

describe("swipe-trending handler", () => {
  let mockUserClient: any;
  let mockAdminClient: any;
  let mockQueryBuilder: any;

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

    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockAdminClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    (getUserClient as vi.Mock).mockReturnValue(mockUserClient);
    (getAdminClient as vi.Mock).mockReturnValue(mockAdminClient);
    (loadSeenTitleIdsForUser as vi.Mock).mockResolvedValue(new Set());
    (computeUserProfile as vi.Mock).mockResolvedValue({});
  });

  it("should return a deck based on trending titles", async () => {
    // Mock the specific responses for this test case
    vi.spyOn(mockAdminClient, "from").mockImplementation((table: string) => {
      if (table === "activity_events") {
        return {
          ...mockQueryBuilder,
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                title_id: "1",
                created_at: new Date().toISOString(),
                event_type: "rating_created",
              },
            ],
            error: null,
          }),
        };
      }
      if (table === "titles") {
        return {
          ...mockQueryBuilder,
          in: vi.fn().mockResolvedValue({
            data: [{ title_id: "1", genres: ["Action"], tmdb_popularity: 100 }],
            error: null,
          }),
        };
      }
      return mockQueryBuilder;
    });

    const req = new Request("http://example.com/swipe-trending");
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.cards.length).toBe(1);
    expect(json.cards[0].id).toBe("1");
  });
});
