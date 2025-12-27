// supabase/functions/_shared/tmdb.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchTmdbTitle, findTmdbByImdbId } from "./tmdb.ts";
import { __setConfigForTesting } from "./config.ts";

const mockConfig = {
  supabaseUrl: "https://test.supabase.co",
  supabaseAnonKey: "test_anon_key",
  supabaseServiceRoleKey: "test_service_key",
  tmdbApiReadAccessToken: "test_tmdb_token",
};
__setConfigForTesting(mockConfig);

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

afterEach(() => {
  vi.clearAllMocks();
});

describe("tmdb helpers", () => {
  describe("fetchTmdbTitle", () => {
    it("should fetch a movie title and its external IDs", async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 123, title: "Test Movie" })),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ imdb_id: "tt123" })),
        );

      const data = await fetchTmdbTitle("movie", 123);

      expect(data.tmdbId).toBe(123);
      expect(data.main.title).toBe("Test Movie");
      expect(data.externalIds.imdb_id).toBe("tt123");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("findTmdbByImdbId", () => {
    it("should find a movie by IMDb ID", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            movie_results: [{ id: 456, title: "Found Movie" }],
            tv_results: [],
          }),
        ),
      );

      const result = await findTmdbByImdbId("tt456");

      expect(result).toEqual({ mediaType: "movie", tmdbId: 456 });
    });

    it("should return null if no result is found", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ movie_results: [], tv_results: [] }),
        ),
      );

      const result = await findTmdbByImdbId("tt999");

      expect(result).toBeNull();
    });
  });
});
