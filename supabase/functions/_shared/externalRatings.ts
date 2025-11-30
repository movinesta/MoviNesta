import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const TMDB_READ_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY");

export type TitleLikeRow = {
  title_id: string;
  tmdb_id?: number | null;
  omdb_imdb_id?: string | null;
  content_type?: string | null;
  imdb_rating?: number | null;
  imdb_votes?: number | null;
  omdb_rt_rating_pct?: number | null;
  last_synced_at?: string | null;
};

async function fetchTmdbJson(path: string): Promise<any | null> {
  if (!TMDB_READ_TOKEN) return null;
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TMDB_READ_TOKEN}` },
  });
  if (!res.ok) {
    console.warn("[external-ratings] TMDb error", res.status, path);
    return null;
  }
  return res.json();
}

async function fetchTmdbExternalIds(tmdbId: number, mediaType: "movie" | "tv") {
  const detailsPath = mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  return fetchTmdbJson(detailsPath);
}

async function fetchOmdbRatings(imdbId: string): Promise<{
  imdbRating: number | null;
  imdbVotes: number | null;
  rtTomatoMeter: number | null;
}> {
  if (!OMDB_API_KEY) return { imdbRating: null, imdbVotes: null, rtTomatoMeter: null };
  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", OMDB_API_KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "short");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn("[external-ratings] OMDb error", res.status, await res.text());
    return { imdbRating: null, imdbVotes: null, rtTomatoMeter: null };
  }

  const json = await res.json();
  if (json.Response === "False") {
    console.warn("[external-ratings] OMDb returned failure", json.Error);
    return { imdbRating: null, imdbVotes: null, rtTomatoMeter: null };
  }

  const imdbRating =
    json.imdbRating && json.imdbRating !== "N/A" ? Number(json.imdbRating) : null;
  const imdbVotes =
    json.imdbVotes && json.imdbVotes !== "N/A"
      ? Number(String(json.imdbVotes).replace(/,/g, ""))
      : null;

  let rtTomatoMeter: number | null = null;
  for (const rating of json.Ratings ?? []) {
    if (rating.Source === "Rotten Tomatoes") {
      const pct = rating.Value?.endsWith("%")
        ? Number(rating.Value.replace("%", ""))
        : null;
      rtTomatoMeter = pct;
    }
  }

  return { imdbRating, imdbVotes, rtTomatoMeter };
}

function needsSync(row?: TitleLikeRow): boolean {
  if (!row) return false;
  const hasRatings =
    typeof row.imdb_rating === "number" || typeof row.omdb_rt_rating_pct === "number";
  if (!hasRatings) return true;
  if (!row.last_synced_at) return true;
  const last = new Date(row.last_synced_at).getTime();
  const ageDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return ageDays > 14;
}

export async function syncExternalRatingsForTitles(
  supabase: SupabaseClient,
  titles: TitleLikeRow[],
): Promise<TitleLikeRow[]> {
  if (!titles.length) return titles;

  for (const title of titles) {
    if (!needsSync(title)) continue;

    let imdbId = title.omdb_imdb_id ?? null;
    if (!imdbId && title.tmdb_id) {
      const tmdb = await fetchTmdbExternalIds(
        title.tmdb_id,
        (title.content_type as string) === "series" ? "tv" : "movie",
      );
      imdbId = tmdb?.imdb_id ?? null;

      if (imdbId) {
        await supabase
          .from("titles")
          .update({ omdb_imdb_id: imdbId })
          .eq("title_id", title.title_id);
      }
    }

    if (!imdbId) continue;

    const omdb = await fetchOmdbRatings(imdbId);
    const payload = {
      imdb_rating: omdb.imdbRating,
      imdb_votes: omdb.imdbVotes,
      omdb_rt_rating_pct: omdb.rtTomatoMeter,
      omdb_imdb_id: imdbId,
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("titles")
      .update(payload)
      .eq("title_id", title.title_id);

    if (error) {
      console.warn("[external-ratings] failed to update titles", error.message);
      continue;
    }

    title.imdb_rating = payload.imdb_rating;
    title.omdb_rt_rating_pct = payload.omdb_rt_rating_pct;
    title.omdb_imdb_id = imdbId;
    title.imdb_votes = payload.imdb_votes ?? null;
    title.last_synced_at = payload.last_synced_at;
  }

  return titles;
}
