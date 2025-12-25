import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";

let mockSupabaseClient: any;

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("../_shared/config.ts", () => ({
  getConfig: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    tmdbApiKey: "tmdb_token",
    omdbApiKey: null,
  }),
}));

vi.mock("../_shared/catalog-sync.ts", () => ({
  triggerCatalogSyncForTitle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2.57.0", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe("catalog-search handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const builder: any = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabaseClient = {
      from: vi.fn(() => builder),
    };
  });

  it("searches TMDB and returns merged results", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ id: 123, media_type: "movie", title: "Test Movie" }],
        }),
        { status: 200 },
      ),
    );

    const req = new Request("http://example.com/catalog-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test" }),
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.query).toBe("test");
    expect(json.results[0].kind).toBe("movie");
    expect(json.results[0].tmdb.title).toBe("Test Movie");

    // Background sync is fire-and-forget; wait a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(triggerCatalogSyncForTitle).toHaveBeenCalledTimes(1);
    expect(triggerCatalogSyncForTitle).toHaveBeenCalledWith(
      expect.any(Request),
      { tmdbId: 123, imdbId: null, contentType: "movie" },
      expect.any(Object),
    );
  });
});
