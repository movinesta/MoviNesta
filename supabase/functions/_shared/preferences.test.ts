import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeUserProfile } from "./preferences";

type TableName =
  | "ratings"
  | "library_entries"
  | "activity_events"
  | "titles";

type QueryResponse = {
  data: any[];
  error: { message: string } | null;
};

const createMockSupabase = (responses: Partial<Record<TableName, QueryResponse>>) => {
  const builderFor = (table: TableName) => {
    const response = responses[table] ?? { data: [], error: null };
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      in: () => (table === "titles" ? Promise.resolve(response) : builder),
      limit: () => Promise.resolve(response),
    };
    return builder;
  };

  return {
    from: (table: TableName) => builderFor(table),
  } as any;
};

describe("computeUserProfile", () => {
  const now = new Date("2024-01-15T00:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  it("builds a weighted profile from ratings, library, and recent events", async () => {
    const supabase = createMockSupabase({
      ratings: {
        data: [
          { title_id: "t1", rating: 8.5 },
          { title_id: "t2", rating: 3 },
        ],
        error: null,
      },
      library_entries: {
        data: [
          { title_id: "t3", status: "watching" },
          { title_id: "t2", status: "dropped" },
        ],
        error: null,
      },
      activity_events: {
        data: [
          {
            title_id: "t4",
            event_type: "rating_created",
            created_at: now.toISOString(),
            payload: { direction: "like" },
          },
          {
            title_id: "t2",
            event_type: "rating_created",
            created_at: now.toISOString(),
            payload: { direction: "dislike" },
          },
        ],
        error: null,
      },
      titles: {
        data: [
          { title_id: "t1", genres: ["Action", "Drama"], content_type: "Movie" },
          { title_id: "t2", genres: ["Horror"], content_type: "Movie" },
          { title_id: "t3", tmdb_genre_names: ["Comedy"], content_type: "Show" },
          { title_id: "t4", omdb_genre_names: ["Action", "Sci-Fi"], content_type: "Movie" },
        ],
        error: null,
      },
    });

    const profile = await computeUserProfile(supabase, "user-1");

    expect(profile).toEqual({
      favoriteGenres: ["action", "drama", "sci-fi", "comedy"],
      dislikedGenres: ["horror"],
      contentTypeWeights: { movie: -0.5, show: 1 },
    });
  });

  it("returns null when no signals can be derived", async () => {
    const supabase = createMockSupabase({});

    const profile = await computeUserProfile(supabase, "user-1");

    expect(profile).toBeNull();
  });
});
