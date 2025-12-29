import { describe, it, expect } from "vitest";
import { computeUserProfile } from "./preferences.ts";

/**
 * Minimal mock of the Supabase client for the queries used in computeUserProfile.
 */
function createMockSupabase(dataMap: Record<string, any[]>) {
  return {
    from: (table: string) => {
      const rows = dataMap[table] ?? [];
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        in: (_col: string, ids: string[]) => {
          // For media_items lookup
          const filtered = rows.filter((r) => ids.includes(String(r.id)));
          return Promise.resolve({ data: filtered, error: null });
        },
      };

      // Terminal call for ratings/library_entries/activity_events (no .in)
      const terminal = Promise.resolve({ data: rows, error: null });
      (chain as any).then = terminal.then.bind(terminal);
      (chain as any).catch = terminal.catch.bind(terminal);

      return chain;
    },
  };
}

describe("computeUserProfile", () => {
  it("computes favorite/disliked genres and content type weights from ratings, library, and activity events", async () => {
    const mock = createMockSupabase({
      ratings: [
        { title_id: "m1", rating: 8.5 },
        { title_id: "m2", rating: 3.0 },
      ],
      library_entries: [{ title_id: "m3" }, { title_id: "m2" }],
      activity_events: [
        { media_item_id: "m1", title_id: null, event_type: "rating_created" },
        { media_item_id: "m4", title_id: null, event_type: "watchlist_added" },
        { media_item_id: "m2", title_id: null, event_type: "watchlist_removed" },
      ],
      media_items: [
        {
          id: "m1",
          kind: "movie",
          tmdb_genres: [
            { id: 28, name: "Action" },
            { id: 18, name: "Drama" },
          ],
          omdb_genre: null,
        },
        { id: "m2", kind: "movie", tmdb_genres: null, omdb_genre: "Horror" },
        { id: "m3", kind: "series", tmdb_genres: null, omdb_genre: "Comedy" },
        {
          id: "m4",
          kind: "movie",
          tmdb_genres: [
            { id: 28, name: "Action" },
            { id: 878, name: "Sci-Fi" },
          ],
          omdb_genre: null,
        },
      ],
    });

    const profile = await computeUserProfile(mock as any, "u1");

    expect(profile).not.toBeNull();

    // Action should be highest because it appears on the highest-weight items.
    expect(profile?.favoriteGenres[0]).toBe("action");
    expect(profile?.favoriteGenres[1]).toBe("drama");

    // Negative weights should push horror into disliked.
    expect(profile?.dislikedGenres).toEqual(["horror"]);

    // Movies dominate (weights normalized by max)
    expect(profile?.contentTypeWeights.movie).toBeCloseTo(1);
    expect(profile?.contentTypeWeights.series).toBeGreaterThan(0);
  });

  it("returns null if there is no activity", async () => {
    const mock = createMockSupabase({
      ratings: [],
      library_entries: [],
      activity_events: [],
      media_items: [],
    });

    const profile = await computeUserProfile(mock as any, "u1");
    expect(profile).toBeNull();
  });
});
