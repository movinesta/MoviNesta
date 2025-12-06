// supabase/functions/swipe-for-you/index.test.ts
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

describe("swipe-for-you handler", () => {
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
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: [{ title_id: "1", genres: ["Action"] }], error: null }),
    };
    (getUserClient as vi.Mock).mockReturnValue(mockUserClient);
    (getAdminClient as vi.Mock).mockReturnValue(mockAdminClient);
    (loadSeenTitleIdsForUser as vi.Mock).mockResolvedValue(new Set());
  });

  it("should return a personalized deck for a user with a profile", async () => {
    (computeUserProfile as vi.Mock).mockResolvedValue({
      favoriteGenres: ["Action"],
      contentTypeWeights: { movie: 0.8, series: 0.2 },
    });

    await import("./index.ts");
    const handler = (serve as vi.Mock).mock.calls[0][0];
    const req = new Request("http://example.com/swipe-for-you");
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.cards.length).toBe(1);
    expect(mockAdminClient.overlaps).toHaveBeenCalledWith("genres", ["Action"]);
  });
});
