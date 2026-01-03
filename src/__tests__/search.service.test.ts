import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalTitleResult } from "../modules/search/externalMovieSearch";

const state = vi.hoisted(() => ({
  supabaseRows: [] as any[],
  externalResults: [] as ExternalTitleResult[],
  invokeResponses: [] as Array<{
    tmdbId?: number;
    imdbId?: string | null;
    contentType?: "movie" | "series";
    mediaItemId?: string | null;
  }>,
}));

const mockInvoke = vi.hoisted(() =>
  vi.fn(async (name: string) => {
    if (name === "media-search") {
      return { data: { ok: true, results: state.supabaseRows, hasMore: false } };
    }
    if (name === "catalog-sync-batch") {
      return { data: { ok: true, results: state.invokeResponses } };
    }
    return { data: { ok: true } };
  }),
);

vi.mock("../lib/supabase", () => {
  const createBuilder = () => {
    const builder: any = {
      _result: null as any,
      select: vi.fn(function select() {
        builder._result = {
          data: state.supabaseRows,
          error: null,
          count: state.supabaseRows.length,
        };
        return builder;
      }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      then: (onfulfilled: (value: any) => any) => {
        const result =
          builder._result ??
          ({
            data: state.supabaseRows,
            error: null,
            count: state.supabaseRows.length,
          } as any);
        return Promise.resolve(result).then(onfulfilled);
      },
    };

    return builder satisfies Record<string, unknown>;
  };

  return {
    supabase: {
      from: vi.fn(() => createBuilder()),
      functions: { invoke: mockInvoke },
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { access_token: "token" } } })),
      },
    },
  };
});

vi.mock("../modules/search/externalMovieSearch", () => ({
  searchExternalTitles: vi.fn(async () => ({ results: state.externalResults, hasMore: false })),
}));

// Import after mocks are registered.
import { searchTitles } from "../modules/search/search.service";

const makeMediaItemRow = (overrides: Partial<any> = {}) => ({
  id: "local-1",
  kind: "movie",
  tmdb_id: 123,
  tmdb_title: "Local Title",
  tmdb_name: null,
  tmdb_original_title: null,
  tmdb_original_name: null,
  tmdb_release_date: "2020-01-01",
  tmdb_first_air_date: null,
  tmdb_poster_path: null,
  tmdb_backdrop_path: null,
  tmdb_original_language: "en",
  tmdb_genre_ids: [],
  omdb_title: null,
  omdb_year: null,
  omdb_language: null,
  omdb_imdb_id: null,
  omdb_imdb_rating: null,
  omdb_rating_rotten_tomatoes: null,
  omdb_poster: null,
  omdb_rated: null,
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
      makeMediaItemRow({ id: "library-1", tmdb_title: "Library Hit", tmdb_id: 111 }),
      makeMediaItemRow({ id: "library-2", tmdb_title: "Already Synced", tmdb_id: 222 }),
    ];

    state.externalResults = [
      makeExternal({ tmdbId: 222, title: "TMDb Duplicate" }),
      makeExternal({ tmdbId: 333, title: "Fresh External" }),
    ];

    const page = await searchTitles({ query: "test" });
    const results = page.results;

    expect(results.map((item) => item.id)).toEqual(["library-1", "library-2", "tmdb-333"]);
    expect(results.map((item) => item.source)).toEqual(["library", "library", "external-only"]);
    expect(results.map((item) => item.title)).toEqual([
      "Library Hit",
      "Already Synced",
      "Fresh External",
    ]);
  });

  it("places library results first, then synced external titles, then external-only entries", async () => {
    state.supabaseRows = [
      makeMediaItemRow({ id: "library-1", tmdb_title: "Library", tmdb_id: 111 }),
    ];

    state.externalResults = [
      makeExternal({ tmdbId: 222, title: "Needs Sync", type: "tv" }),
      makeExternal({ tmdbId: 333, title: "External Only" }),
    ];

    state.invokeResponses.push(
      { tmdbId: 222, contentType: "series", mediaItemId: "synced-222" },
      { tmdbId: 333, contentType: "movie", mediaItemId: null },
    );

    const page = await searchTitles({ query: "test" });
    const results = page.results;

    expect(results.map((item) => ({ id: item.id, type: item.type, source: item.source }))).toEqual([
      { id: "library-1", type: "movie", source: "library" },
      { id: "synced-222", type: "series", source: "external-synced" },
      { id: "tmdb-333", type: "movie", source: "external-only" },
    ]);
  });
});
