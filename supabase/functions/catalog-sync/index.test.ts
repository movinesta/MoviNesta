// supabase/functions/catalog-sync/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import * as tmdb from "../_shared/tmdb.ts";

vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("../_shared/supabase.ts", () => ({
  getAdminClient: vi.fn(),
}));

vi.mock("../_shared/tmdb.ts", () => ({
  tmdbGetDetails: vi.fn(),
  tmdbFindByImdb: vi.fn(),
}));

describe("catalog-sync handler", () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({
        data: { title_id: "new-uuid" },
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    (getAdminClient as vi.Mock).mockReturnValue(mockSupabaseClient);
  });

  it("should sync a new movie title from tmdbId", async () => {
    (tmdb.tmdbGetDetails as vi.Mock).mockResolvedValue({
      id: 123,
      title: "Test Movie",
      imdb_id: "tt123",
      external_ids: { imdb_id: "tt123" },
    });

    const req = new Request("http://example.com/catalog-sync", {
      method: "POST",
      body: JSON.stringify({ tmdbId: 123, contentType: "movie" }),
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.title_id).toBe("new-uuid");
    expect(mockSupabaseClient.insert).toHaveBeenCalled();
  });
});
