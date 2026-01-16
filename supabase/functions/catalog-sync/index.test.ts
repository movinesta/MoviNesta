import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";

let mockSupabaseClient: any;

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("../_shared/config.ts", () => ({
  getConfig: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    tmdbApiReadAccessToken: "tmdb_key",
    omdbApiKey: "omdb_key",
    tastediveApiKey: "",
    internalJobToken: "",
  }),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2.49.1", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe("catalog-sync handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "00000000-0000-0000-0000-000000000001",
          kind: "movie",
          tmdb_id: 123,
          omdb_imdb_id: null,
        },
        error: null,
      }),
    };

    mockSupabaseClient = {
      from: vi.fn(() => builder),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
    };

    mockFetch.mockImplementation(async (input: any) => {
      const url = typeof input === "string" ? input : String(input);

      // TMDB movie details
      if (url.includes("/movie/123")) {
        return new Response(
          JSON.stringify({
            id: 123,
            imdb_id: "tt1234567",
            title: "Test Movie",
            release_date: "2020-01-01",
            genres: [{ id: 28, name: "Action" }],
          }),
          { status: 200 },
        );
      }

      // Default fallback
      return new Response(JSON.stringify({}), { status: 200 });
    });
  });

  it("upserts into media_items and returns media_item_id", async () => {
    const req = new Request("http://example.com/catalog-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer user_token",
      },
      body: JSON.stringify({
        tmdbId: 123,
        contentType: "movie",
        options: { syncOmdb: false },
      }),
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.media_item_id).toBe("00000000-0000-0000-0000-000000000001");
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("media_items");
  });
});
