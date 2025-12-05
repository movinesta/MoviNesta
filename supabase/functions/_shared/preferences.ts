// supabase/functions/_shared/preferences.ts
//
// User preference profiling for swipe decks.
// Builds a small profile from ratings, library, and swipe activity.
//
// This implementation is designed to be robust and cheap enough to run
// inside edge functions.

export type UserProfile = {
  favoriteGenres: string[];
  dislikedGenres: string[];
  contentTypeWeights: Record<string, number>;
};

const MAX_SOURCE_ROWS = 500;
const MAX_TITLE_ROWS = 300;
const FAVORITE_GENRE_LIMIT = 10;
const DISLIKED_GENRE_LIMIT = 6;

/**
 * Compute a lightweight preference profile for the given user.
 *
 * It looks at:
 *  - ratings: strong positive / negative signals
 *  - library entries: positive signals
 *  - activity_events: extra signals from swipes, rating events, etc.
 *
 * The result is:
 *  - favoriteGenres: top positively weighted genres
 *  - dislikedGenres: top negatively weighted genres
 *  - contentTypeWeights: score per content_type ("movie", "series", etc.)
 */
export async function computeUserProfile(
  supabase: any,
  userId: string,
): Promise<UserProfile | null> {
  // Load ratings, library entries, and activity for this user.
  const [ratingsRes, libraryRes, activityRes] = await Promise.all([
    supabase
      .from("ratings")
      .select("title_id, rating")
      .eq("user_id", userId)
      .limit(MAX_SOURCE_ROWS),
    supabase
      .from("library_entries")
      .select("title_id")
      .eq("user_id", userId)
      .limit(MAX_SOURCE_ROWS),
    supabase
      .from("activity_events")
      .select("title_id, event_type")
      .eq("user_id", userId)
      .limit(MAX_SOURCE_ROWS),
  ]);

  const ratings = ratingsRes.error ? [] : ratingsRes.data ?? [];
  const libraryEntries = libraryRes.error ? [] : libraryRes.data ?? [];
  const activity = activityRes.error ? [] : activityRes.data ?? [];

  // If the user has no data at all, return null so callers can fall back
  // to non-personalized behaviour.
  if (!ratings.length && !libraryEntries.length && !activity.length) {
    return null;
  }

  // Aggregate weights per title_id.
  const titleWeights = new Map<string, number>();

  // Ratings → positive/negative signal
  for (const row of ratings) {
    const titleId = (row as any).title_id as string | null;
    const rating = (row as any).rating as number | null;
    if (!titleId || rating == null) continue;

    let w = 0;
    if (rating >= 9) w = 4;
    else if (rating >= 8) w = 3;
    else if (rating >= 7) w = 1.5;
    else if (rating <= 4) w = -3;
    else if (rating <= 5) w = -1;

    if (!w) continue;
    titleWeights.set(titleId, (titleWeights.get(titleId) ?? 0) + w);
  }

  // Library entries → mild positive signal
  for (const row of libraryEntries) {
    const titleId = (row as any).title_id as string | null;
    if (!titleId) continue;
    titleWeights.set(titleId, (titleWeights.get(titleId) ?? 0) + 0.75);
  }

  // Activity events → extra signal
  for (const row of activity) {
    const titleId = (row as any).title_id as string | null;
    const eventType = (row as any).event_type as string | null;
    if (!titleId) continue;

    let w = 0;
    if (eventType === "rating_created" || eventType === "rating_updated") {
      w = 1;
    } else if (eventType === "library_added") {
      w = 0.75;
    } else if (eventType === "swipe_like") {
      w = 1;
    } else if (eventType === "swipe_dislike") {
      w = -1;
    }

    if (!w) continue;
    titleWeights.set(titleId, (titleWeights.get(titleId) ?? 0) + w);
  }

  if (!titleWeights.size) {
    return null;
  }

  // Pick the top titles by absolute weight to inspect.
  const sortedTitles = Array.from(titleWeights.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, MAX_TITLE_ROWS);

  const titleIds = sortedTitles.map(([titleId]) => titleId);

  const { data: titleRows, error: titleError } = await supabase
    .from("titles")
    .select("title_id, genres, content_type")
    .in("title_id", titleIds)
    .is("deleted_at", null);

  if (titleError) {
    console.warn(
      "[preferences] titles query error in computeUserProfile:",
      titleError.message,
    );
    return null;
  }

  const genreScores = new Map<string, number>();
  const negativeGenreScores = new Map<string, number>();
  const contentTypeScores = new Map<string, number>();

  const weightByTitle = new Map<string, number>(sortedTitles);

  for (const row of titleRows ?? []) {
    const titleId = String((row as any).title_id);
    const weight = weightByTitle.get(titleId);
    if (weight == null) continue;

    const genres = normalizeGenres((row as any).genres);
    const contentType = ((row as any).content_type ?? "").toString();

    for (const g of genres) {
      if (weight > 0) {
        genreScores.set(g, (genreScores.get(g) ?? 0) + weight);
      } else if (weight < 0) {
        negativeGenreScores.set(g, (negativeGenreScores.get(g) ?? 0) + weight);
      }
    }

    if (contentType) {
      if (weight > 0) {
        contentTypeScores.set(
          contentType,
          (contentTypeScores.get(contentType) ?? 0) + weight,
        );
      }
    }
  }

  const favoriteGenres = Array.from(genreScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, FAVORITE_GENRE_LIMIT)
    .map(([genre]) => genre);

  const dislikedGenres = Array.from(negativeGenreScores.entries())
    .sort((a, b) => a[1] - b[1]) // more negative first
    .slice(0, DISLIKED_GENRE_LIMIT)
    .map(([genre]) => genre);

  // Normalize contentTypeScores to [0, 1] range (max -> 1).
  const ctEntries = Array.from(contentTypeScores.entries());
  const ctMax = ctEntries.reduce(
    (max, [, v]) => (v > max ? v : max),
    0,
  );

  const contentTypeWeights: Record<string, number> = {};

  if (ctMax > 0) {
    for (const [ct, score] of ctEntries) {
      contentTypeWeights[ct] = score / ctMax;
    }
  }

  return {
    favoriteGenres,
    dislikedGenres,
    contentTypeWeights,
  };
}

function normalizeGenres(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const v of raw) {
      const s = String(v).trim().toLowerCase();
      if (!s) continue;
      out.push(s);
    }
    return out;
  }

  // Support comma-separated strings
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((g) => g.trim().toLowerCase())
      .filter((g) => g.length > 0);
  }

  return [];
}
