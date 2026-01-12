// supabase/functions/_shared/preferences.ts
//
// User preference profiling for swipe decks.
//
// Schema source of truth: schema_full_20251224_004751.sql
// - Ratings/library use `title_id` (uuid) that references `public.media_items.id`.
// - Activity events include `media_item_id` (uuid) and also `title_id` (text); use
//   `media_item_id` first and fall back to `title_id` only when it looks like a uuid.

export type UserProfile = {
  favoriteGenres: string[];
  dislikedGenres: string[];
  contentTypeWeights: Record<string, number>;
};

const MAX_SOURCE_ROWS = 500;
const MAX_ITEM_ROWS = 300;
const FAVORITE_GENRE_LIMIT = 10;
const DISLIKED_GENRE_LIMIT = 6;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function normalizeGenresFromMediaItem(row: any): string[] {
  const out = new Set<string>();

  // tmdb_genres is typically: [{ id: 28, name: "Action" }, ...]
  const tmdbGenres = row?.tmdb_genres;
  if (Array.isArray(tmdbGenres)) {
    for (const g of tmdbGenres) {
      const name = typeof g?.name === "string" ? g.name.trim().toLowerCase() : "";
      if (name) out.add(name);
    }
  }

  // OMDb genres are typically: "Action, Drama"
  const omdbGenre = typeof row?.omdb_genre === "string" ? row.omdb_genre : null;
  if (omdbGenre) {
    for (const part of omdbGenre.split(",")) {
      const name = part.trim().toLowerCase();
      if (name) out.add(name);
    }
  }

  return Array.from(out);
}

/**
 * Compute a lightweight preference profile for the given user.
 */
export async function computeUserProfile(
  supabase: any,
  userId: string,
): Promise<UserProfile | null> {
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
      .select("media_item_id, title_id, event_type")
      .eq("user_id", userId)
      .limit(MAX_SOURCE_ROWS),
  ]);

  const ratings = ratingsRes.error ? [] : ratingsRes.data ?? [];
  const libraryEntries = libraryRes.error ? [] : libraryRes.data ?? [];
  const activity = activityRes.error ? [] : activityRes.data ?? [];

  if (!ratings.length && !libraryEntries.length && !activity.length) {
    return null;
  }

  const itemWeights = new Map<string, number>();
  const addWeight = (id: string, delta: number) => {
    itemWeights.set(id, (itemWeights.get(id) ?? 0) + delta);
  };

  // Ratings
  for (const row of ratings) {
    const id = (row as any).title_id as string | null;
    const rating = (row as any).rating as number | null;
    if (!id || rating == null) continue;

    let w = 0;
    if (rating >= 9) w = 4;
    else if (rating >= 8) w = 3;
    else if (rating >= 7) w = 1.5;
    else if (rating <= 4) w = -3;
    else if (rating <= 5) w = -1;

    if (w) addWeight(id, w);
  }

  // Library entries (watchlist)
  for (const row of libraryEntries) {
    const id = (row as any).title_id as string | null;
    if (!id) continue;
    addWeight(id, 0.75);
  }

  // Activity events (use media_item_id when available)
  for (const row of activity) {
    const id =
      ((row as any).media_item_id as string | null) ??
      (isUuid((row as any).title_id) ? ((row as any).title_id as string) : null);

    if (!id) continue;

    const eventType = (row as any).event_type as string | null;
    let w = 0;

    if (eventType === "rating_created" || eventType === "review_created") {
      w = 1;
    } else if (eventType === "watchlist_added") {
      w = 0.75;
    } else if (eventType === "watchlist_removed") {
      w = -0.25;
    }

    if (w) addWeight(id, w);
  }

  if (!itemWeights.size) return null;

  const sortedItems = Array.from(itemWeights.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, MAX_ITEM_ROWS);

  const itemIds = sortedItems.map(([id]) => id);

  const { data: mediaItems, error: mediaError } = await supabase
    .from("media_items")
    .select("id, kind, tmdb_genres, omdb_genre")
    .in("id", itemIds);

  if (mediaError) {
    console.warn("[preferences] media_items query error:", mediaError.message);
    return null;
  }

  const genreScores = new Map<string, number>();
  const negativeGenreScores = new Map<string, number>();
  const kindScores = new Map<string, number>();
  const weightById = new Map<string, number>(sortedItems);

  for (const row of mediaItems ?? []) {
    const id = String((row as any).id);
    const w = weightById.get(id);
    if (w == null) continue;

    const genres = normalizeGenresFromMediaItem(row);
    const kind = typeof (row as any).kind === "string" ? (row as any).kind : "";

    for (const g of genres) {
      if (w > 0) genreScores.set(g, (genreScores.get(g) ?? 0) + w);
      else if (w < 0) negativeGenreScores.set(g, (negativeGenreScores.get(g) ?? 0) + w);
    }

    if (kind && w > 0) {
      kindScores.set(kind, (kindScores.get(kind) ?? 0) + w);
    }
  }

  const favoriteGenres = Array.from(genreScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, FAVORITE_GENRE_LIMIT)
    .map(([g]) => g);

  const dislikedGenres = Array.from(negativeGenreScores.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, DISLIKED_GENRE_LIMIT)
    .map(([g]) => g);

  const kindEntries = Array.from(kindScores.entries());
  const max = kindEntries.reduce((m, [, v]) => (v > m ? v : m), 0);
  const contentTypeWeights: Record<string, number> = {};

  if (max > 0) {
    for (const [k, v] of kindEntries) {
      contentTypeWeights[k] = v / max;
    }
  }

  return { favoriteGenres, dislikedGenres, contentTypeWeights };
}
