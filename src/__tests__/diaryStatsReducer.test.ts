import { describe, expect, it } from "vitest";
import {
  reduceDiaryStats,
  type RatingsRow,
  type LibraryRow,
  computeTopGenres,
  mapGenresById,
  type TitleGenreRow,
  type GenreLookupRow,
} from "../modules/diary/diaryStatsReducer";

describe("reduceDiaryStats", () => {
  it("computes averages and rating distribution buckets", () => {
    const ratings: RatingsRow[] = [
      { rating: 4.6, created_at: "2024-01-10", title_id: "a" },
      { rating: 4.25, created_at: "2024-02-10", title_id: "b" },
      { rating: 2, created_at: "2024-03-10", title_id: "c" },
      // Should be ignored
      { rating: Number.NaN, created_at: "2024-04-10", title_id: "d" },
    ];

    const library: LibraryRow[] = [
      { title_id: "a", status: "watched", updated_at: "2024-02-02" },
      { title_id: "b", status: "watched", updated_at: "2024-02-18" },
      { title_id: "c", status: "watching", updated_at: "2024-03-01" },
      { title_id: "d", status: "watched", updated_at: "invalid" },
    ];

    const stats = reduceDiaryStats(ratings, library);

    expect(stats.totalRated).toBe(4);
    expect(stats.totalWatched).toBe(3);
    expect(stats.averageRating).toBeCloseTo((4.6 + 4.25 + 2) / 3, 5);
    expect(stats.ratingDistribution).toEqual([
      { rating: 2, count: 1 },
      { rating: 4.5, count: 2 },
    ]);
    expect(stats.watchCountByMonth).toEqual([{ month: "2024-02", count: 2 }]);
  });

  it("sorts watch counts chronologically and respects top genres input", () => {
    const ratings: RatingsRow[] = [{ rating: 5, created_at: "2023-01-01", title_id: "x" }];
    const library: LibraryRow[] = [
      { title_id: "x", status: "watched", updated_at: "2023-11-05" },
      { title_id: "y", status: "watched", updated_at: "2023-01-09" },
      { title_id: "z", status: "watched", updated_at: "2024-01-01" },
    ];

    const stats = reduceDiaryStats(ratings, library, [{ genre: "drama", count: 3 }]);

    expect(stats.watchCountByMonth).toEqual([
      { month: "2023-01", count: 1 },
      { month: "2023-11", count: 1 },
      { month: "2024-01", count: 1 },
    ]);
    expect(stats.topGenres).toEqual([{ genre: "drama", count: 3 }]);
  });
});

describe("computeTopGenres", () => {
  it("aggregates genre counts for watched titles only", () => {
    const watched: LibraryRow[] = [
      { title_id: "a", status: "watched", updated_at: "2024-01-01" },
      { title_id: "b", status: "watched", updated_at: "2024-01-02" },
      { title_id: "c", status: "watching", updated_at: "2024-01-03" },
    ];

    const titleGenres: TitleGenreRow[] = [
      { title_id: "a", genre_id: 10 },
      { title_id: "b", genre_id: 11 },
      { title_id: "c", genre_id: 12 },
      { title_id: "a", genre_id: 10 },
    ];

    const genres: GenreLookupRow[] = [
      { id: 10, name: "Drama" },
      { id: 11, name: "Comedy" },
      { id: 12, name: "Horror" },
    ];

    const result = computeTopGenres(watched, titleGenres, mapGenresById(genres));

    expect(result).toEqual([
      { genre: "Drama", count: 2 },
      { genre: "Comedy", count: 1 },
    ]);
  });
});
