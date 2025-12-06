// supabase/functions/swipe-more-like-this/index.test.ts
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
}));

vi.mock("../_shared/swipe.ts", () => ({
  loadSeenTitleIdsForUser: vi.fn(),
}));

describe("swipe-more-like-this handler", () => {
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
    mockAdminClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { title_id: "seed", genres: ["Sci-Fi"] },
        error: null,
      }),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ title_id: "1", genres: ["Sci-Fi"] }],
        error: null,
      }),
    };
    (getUserClient as vi.Mock).mockReturnValue(mockUserClient);
    (getAdminClient as vi.Mock).mockReturnValue(mockAdminClient);
    (loadSeenTitleIdsForUser as vi.Mock).mockResolvedValue(new Set());
    (computeUserProfile as vi.Mock).mockResolvedValue({});
  });

  it("should return a deck of similar titles", async () => {
    const req = new Request(
      "http://example.com/swipe-more-like-this?title_id=00000000-0000-0000-0000-000000000000",
    );
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.cards.length).toBe(1);
    expect(json.cards[0].title_id).toBe("1");
  });
});
