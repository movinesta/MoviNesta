// supabase/functions/_shared/swipe.ts
//
// Shared helpers for swipe edge functions.
// - loadSeenTitleIdsForUser: returns a Set<title_id> this user has already
//   interacted with (ratings, library entries, swipe activity).
//
// This is used by swipe-for-you, swipe-from-friends, and swipe-trending
// to avoid showing duplicate cards to the same user.

export async function loadSeenTitleIdsForUser(
  supabase: any,
  userId: string,
  opts?: { limit?: number },
): Promise<Set<string>> {
  const limit = opts?.limit ?? 2000;
  const seen = new Set<string>();

  // Ratings
  try {
    const { data, error } = await supabase
      .from("ratings")
      .select("title_id")
      .eq("user_id", userId)
      .limit(limit);

    if (error) {
      console.warn("[swipe:seen] ratings error", error);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        if (row?.title_id) {
          seen.add(String(row.title_id));
        }
      }
    }
  } catch (err) {
    console.warn("[swipe:seen] ratings fetch failed", err);
  }

  // Library entries
  try {
    const { data, error } = await supabase
      .from("library_entries")
      .select("title_id")
      .eq("user_id", userId)
      .limit(limit);

    if (error) {
      console.warn("[swipe:seen] library_entries error", error);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        if (row?.title_id) {
          seen.add(String(row.title_id));
        }
      }
    }
  } catch (err) {
    console.warn("[swipe:seen] library_entries fetch failed", err);
  }

  // Activity events (swipes, rating_created, etc.)
  try {
    const { data, error } = await supabase
      .from("activity_events")
      .select("title_id")
      .eq("user_id", userId)
      .limit(limit);

    if (error) {
      console.warn("[swipe:seen] activity_events error", error);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        if (row?.title_id) {
          seen.add(String(row.title_id));
        }
      }
    }
  } catch (err) {
    console.warn("[swipe:seen] activity_events fetch failed", err);
  }

  return seen;
}

export interface SwipeApiCard {
  id: string;
  title: string;
  year?: number | null;
  type?: string | null;
  contentType?: string | null;
  posterUrl?: string | null;
  tmdbPosterPath?: string | null;
  tmdbBackdropPath?: string | null;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
  runtimeMinutes?: number | null;
  tagline?: string | null;
  overview?: string | null;
  genres?: string[] | null;
}

export function mapTitleRowToSwipeCard(title: Record<string, any>): SwipeApiCard {
  return {
    id: String(title.title_id),
    title: title.primary_title ?? "(Untitled)",
    year: title.release_year ?? null,
    type: title.content_type ?? null,
    contentType: title.content_type ?? null,
    posterUrl: title.poster_url ?? null,
    tmdbPosterPath: title.tmdb_poster_path ?? null,
    tmdbBackdropPath: title.tmdb_backdrop_path ?? title.backdrop_url ?? null,
    imdbRating: title.imdb_rating ?? null,
    rtTomatoMeter: title.rt_tomato_pct ?? null,
    runtimeMinutes: title.runtime_minutes ?? title.tmdb_runtime ?? null,
    tagline: title.tagline ?? null,
    overview: title.tmdb_overview ?? title.plot ?? null,
    genres: title.genres ?? title.tmdb_genre_names ?? null,
  };
}
