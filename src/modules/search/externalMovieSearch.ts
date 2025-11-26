/**
 * External movie search helpers using OMDb, now via Supabase Edge Functions.
 *
 * The key names come from `apikey.sql`:
 *   - OMDB_API_KEY          (server-side, used by edge functions)
 *   - VITE_OMDB_API_KEY     (frontend/Vite, optional fallback)
 *
 * For best security and performance the client calls the Supabase edge function
 * `omdb-search` first, and only falls back to direct OMDb access when needed.
 */

import { supabase } from "../../lib/supabase";

export type ExternalTitleResult = {
  imdbId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  source: "omdb";
};

type OmdbSearchItem = {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
};

type OmdbSearchResponse = {
  Search?: OmdbSearchItem[];
  totalResults?: string;
  Response: "True" | "False";
  Error?: string;
};

function mapOmdbItemToResult(item: OmdbSearchItem): ExternalTitleResult {
  return {
    imdbId: item.imdbID,
    title: item.Title ?? "Untitled",
    year: item.Year ? Number.parseInt(item.Year, 10) || null : null,
    posterUrl: item.Poster && item.Poster !== "N/A" ? item.Poster : null,
    source: "omdb",
  };
}

// Optional: direct OMDb fallback if the function or env fails.
async function fallbackDirectOmdbSearch(query: string): Promise<ExternalTitleResult[]> {
  const omdbApiKey = import.meta.env.VITE_OMDB_API_KEY;
  if (!omdbApiKey) return [];

  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", omdbApiKey);
  url.searchParams.set("s", trimmed);
  url.searchParams.set("type", "movie");
  url.searchParams.set("page", "1");

  const response = await fetch(url.toString());
  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      "[externalMovieSearch] OMDb fallback returned HTTP error:",
      response.status,
    );
    return [];
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text();
    // eslint-disable-next-line no-console
    console.warn(
      "[externalMovieSearch] OMDb fallback returned non-JSON response:",
      text.slice(0, 120),
    );
    return [];
  }

  const json = (await response.json()) as OmdbSearchResponse;

  if (json.Response === "False" || !json.Search || json.Search.length === 0) {
    return [];
  }

  return json.Search.map(mapOmdbItemToResult);
}

/**
 * Call the Supabase edge function `omdb-search` as the primary way to search
 * external titles. This keeps the OMDb API key on the server.
 * We only fall back to direct OMDb usage when the edge function fails or is
 * not yet configured.
 */
export async function searchExternalTitles(query: string): Promise<ExternalTitleResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const { data, error } = await supabase.functions.invoke<OmdbSearchResponse>(
      "omdb-search",
      {
        method: "POST",
        body: {
          query: trimmed,
          type: "movie",
        },
      },
    );

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[externalMovieSearch] edge function error:", error);
      return fallbackDirectOmdbSearch(trimmed);
    }

    if (!data || data.Response === "False" || !data.Search || data.Search.length === 0) {
      return [];
    }

    return data.Search.map(mapOmdbItemToResult);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[externalMovieSearch] unexpected error, falling back to direct OMDb:", err);
    return fallbackDirectOmdbSearch(trimmed);
  }
}
