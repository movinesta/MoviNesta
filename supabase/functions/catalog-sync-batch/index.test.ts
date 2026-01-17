// supabase/functions/catalog-sync-batch/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";

vi.mock("jsr:@std/http@0.224.0/server", () => ({
  serve: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("catalog-sync-batch handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process a batch of sync requests", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ titleId: "synced-uuid" })),
    );

    const req = new Request("http://example.com/catalog-sync-batch", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
      body: JSON.stringify({
        items: [
          { tmdbId: 1, contentType: "movie" },
          { tmdbId: 2, contentType: "tv" },
        ],
      }),
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.results.length).toBe(2);
    expect(json.results[0].status).toBe("fulfilled");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should handle failed syncs in a batch", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ titleId: "synced-uuid" })),
      )
      .mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }));

    const req = new Request("http://example.com/catalog-sync-batch", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
      body: JSON.stringify({
        items: [
          { tmdbId: 1, contentType: "movie" },
          { tmdbId: 2, contentType: "tv" },
        ],
      }),
    });

    const res = await handler(req);
    const json = await res.json();

    expect(json.results[0].status).toBe("fulfilled");
    expect(json.results[1].status).toBe("rejected");
    expect(json.results[1].error).toBe("Internal Server Error");
  });
});
