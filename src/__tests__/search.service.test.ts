import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalTitleResult } from "../modules/search/externalMovieSearch";

const state = vi.hoisted(() => ({
  supabaseRows: [] as any[],
  externalResults: [] as ExternalTitleResult[],
  invokeResponses: [] as Array<{ titleId?: string; tmdbId?: number; imdbId?: string }>,
}));

const mockInvoke = vi.hoisted(() =>
  vi.fn(async () => ({ data: state.invokeResponses.shift() ?? {} })),
);

vi.mock("../lib/supabase", () => {
  const createBuilder = () => {
    return {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      returns: vi.fn().mockImplementation(async () => ({
        data: state.supabaseRows,
        error: null,
      })),
    } satisfies Record<string, unknown>;
  };

  return {
    supabase: {
      from: vi.fn(() => createBuilder()),
      functions: { invoke: mockInvoke },
    },
  };
});

vi.mock("../modules/search/externalMovieSearch", () => ({
  searchExternalTitles: vi.fn(async () => state.externalResults),
}));

// Import after mocks are registered.
import { searchTitles } from "../modules/search/search.service";

const makeTitleRow = (overrides: Partial<any> = {}) => ({
  id: "local-1",
  primary_title: "Local Title",
  original_title: null,
  release_year: 2020,
  content_type: "movie",
  poster_url: null,
  backdrop_url: null,
  language: "en",
  omdb_rated: null,
  omdb_imdb_id: null,
  tmdb_id: 123,
  imdb_rating: null,
  omdb_rt_rating_pct: null,
  ...overrides,
});

const makeExternal = (overrides: Partial<ExternalTitleResult> = {}): ExternalTitleResult => ({
  tmdbId: 456,
  imdbId: null,
  title: "External Title",
  year: 2022,
  type: "movie",
  posterUrl: "https://example.com/poster.jpg",
  ...overrides,
});

describe("searchTitles merge logic", () => {
  beforeEach(() => {
    state.supabaseRows = [];
    state.externalResults = [];
    state.invokeResponses.length = 0;
    mockInvoke.mockClear();
    vi.clearAllMocks();
  });

  it("dedupes Supabase and TMDb results on tmdbId while preserving library entries", async () => {
    state.supabaseRows = [
      makeTitleRow({ id: "library-1", primary_title: "Library Hit", tmdb_id: 111 }),
      makeTitleRow({ id: "library-2", primary_title: "Already Synced", tmdb_id: 222 }),
    ];

    state.externalResults = [
      makeExternal({ tmdbId: 222, title: "TMDb Duplicate" }),
      makeExternal({ tmdbId: 333, title: "Fresh External" }),
    ];

    const results = await searchTitles({ query: "test" });

    expect(results.map((item) => item.id)).toEqual([
      "library-1",
      "library-2",
      "tmdb-333",
    ]);
    expect(results.map((item) => item.source)).toEqual([
      "library",
      "library",
      "external-only",
    ]);
    expect(results.map((item) => item.title)).toEqual([
      "Library Hit",
      "Already Synced",
      "Fresh External",
    ]);
  });

  it("places library results first, then synced external titles, then external-only entries", async () => {
    state.supabaseRows = [makeTitleRow({ id: "library-1", primary_title: "Library", tmdb_id: 111 })];

    state.externalResults = [
      makeExternal({ tmdbId: 222, title: "Needs Sync", type: "tv" }),
      makeExternal({ tmdbId: 333, title: "External Only" }),
    ];

    state.invokeResponses.push({ titleId: "synced-222" }, {});

    const results = await searchTitles({ query: "test" });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(results.map((item) => ({ id: item.id, type: item.type, source: item.source }))).toEqual([
      { id: "library-1", type: "movie", source: "library" },
      { id: "synced-222", type: "series", source: "external-synced" },
      { id: "tmdb-333", type: "movie", source: "external-only" },
    ]);
  });
});
