// supabase/functions/catalog-backfill/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";
import {
  fetchTmdbDiscover,
  fetchTmdbTrending,
} from "../_shared/tmdb.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("../_shared/tmdb.ts", () => ({
  fetchTmdbDiscover: vi.fn(),
  fetchTmdbTrending: vi.fn(),
}));

vi.mock("../_shared/catalog-sync.ts", () => ({
  triggerCatalogSyncForTitle: vi.fn(),
}));

describe("catalog-backfill handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should backfill movies and tv shows", async () => {
    (fetchTmdbTrending as vi.Mock).mockResolvedValue({
      results: [{ id: 1 }, { id: 2 }],
    });
    (fetchTmdbDiscover as vi.Mock).mockResolvedValue({
      results: [{ id: 3 }, { id: 4 }],
    });

    const req = new Request("http://example.com/catalog-backfill", {
      method: "POST",
      body: JSON.stringify({
        mediaTypes: ["movie", "tv"],
        pagesPerType: 1,
      }),
    });
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.results.movie.discovered).toBe(4);
    expect(json.results.movie.enqueued).toBe(4);
    expect(triggerCatalogSyncForTitle).toHaveBeenCalledTimes(8);
  });
});
