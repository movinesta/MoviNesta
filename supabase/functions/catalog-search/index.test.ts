// supabase/functions/catalog-search/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("../_shared/supabase.ts", () => ({
  getUserClient: vi.fn(),
}));

vi.mock("../_shared/catalog-sync.ts", () => ({
  triggerCatalogSyncForTitle: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("catalog-search handler", () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    (getUserClient as vi.Mock).mockReturnValue(mockSupabaseClient);
  });

  it("should search for a title", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({
        results: [{ id: 123, title: "Test Movie" }],
      })),
    );

    const req = new Request("http://example.com/catalog-search", {
      method: "POST",
      body: JSON.stringify({ query: "test" }),
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results[0].title).toBe("Test Movie");
    expect(triggerCatalogSyncForTitle).toHaveBeenCalledTimes(1);
  });
});
