// supabase/functions/_shared/preferences.ts
//
// User preference profiling for swipe decks.
// Builds a small profile from ratings, library, and swipe activity.

export type UserProfile = {
  favoriteGenres: string[];
  dislikedGenres: string[];
  contentTypeWeights: Record<string, number>;
};

const MAX_SOURCE_ROWS = 500;
const MAX_TITLE_ROWS = 300;
const FAVORITE_GENRE_LIMIT = 10;
const DISLIKED_GENRE_LIMIT = 6;

export async function computeUserProfile(
  supabase: any,
  userId: string,
): Promise<UserProfile | null> {
  const [
    { data: ratings, error: ratingsError },
    { data: libraryRows, error: libraryError },
    { data: events, error: eventsError },
  ] = await Promise.all([
    supabase
      .from("ratings")
      .select("title_id, rating")
      .eq("user_id", userId)
      .limit(MAX_SOURCE_ROWS),
    supabase
      .from("library_entries")
      .select("title_id, status")
      .eq("user_id", userId)
      .limit(MAX_SOURCE_ROWS),
    supabase
      .from("activity_events")
      .select("title_id, event_type, created_at, payload")
      .eq("user_id", userId)
      .in("event_type", ["rating_created", "swipe_skipped"])
      .order("created_at", { ascending: false })
      .limit(MAX_SOURCE_ROWS),
  ]);

  if (ratingsError) {
    console.warn("[preferences] ratings error:", ratingsError.message);
  }
  if (libraryError) {
    console.warn("[preferences] library_entries error:", libraryError.message);
  }
  if (eventsError) {
    console.warn("[preferences] activity_events error:", eventsError.message);
  }

  const titleWeights = new Map<string, number>();

  // Ratings → positive/negative signal
  for (const row of ratings ?? []) {
    const titleId = (row as any).title_id as string | null;
    const rating = (row as any).rating as number | null;
    if (!titleId || rating == null) continue;

    let w = 0;
    if (rating >= 8) w = 3;
    else if (rating >= 6) w = 1.5;
    else if (rating <= 4) w = -3;

    if (!w) continue;
    titleWeights.set(titleId, (titleWeights.get(titleId) ?? 0) + w);
  }

  // Library → soft preference
  for (const row of libraryRows ?? []) {
    const titleId = (row as any).title_id as string | null;
    const status = ((row as any).status as string | null) ?? "";
    if (!titleId) continue;

    let w = 0;
    const normalized = status.toLowerCase();
    if (normalized === "want_to_watch" || normalized === "watching") {
      w = 1;
    } else if (normalized === "dropped") {
      w = -1;
    }

    if (!w) continue;
    titleWeights.set(titleId, (titleWeights.get(titleId) ?? 0) + w);
  }

  // Activity events → recency-weighted signal
  const now = Date.now();
  for (const row of events ?? []) {
    const titleId = (row as any).title_id as string | null;
    if (!titleId) continue;

    const eventType = (row as any).event_type as string | null;
    const payload = (row as any).payload as any | null;
    const createdAtStr = (row as any).created_at as string | null;

    const direction = (payload?.direction as string | null) ?? null;

    let base = 0;
    if (eventType === "rating_created") {
      if (direction === "like") base = 2.5;
      else if (direction === "dislike") base = -2;
      else base = 1.5;
    } else if (eventType === "swipe_skipped") {
      base = 0;
    }

    if (!base) continue;

    let recencyFactor = 1;
    if (createdAtStr) {
      const createdAt = new Date(createdAtStr).getTime();
      const days = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
      recencyFactor = 1 / (1 + days / 30);
    }

    const w = base * recencyFactor;
    titleWeights.set(titleId, (titleWeights.get(titleId) ?? 0) + w);
  }

  if (!titleWeights.size) {
    return null;
  }

  const titleIds = Array.from(titleWeights.keys()).slice(0, MAX_TITLE_ROWS);
  const { data: titleRows, error: titleError } = await supabase
    .from("titles")
    .select(
      [
        "title_id",
        "genres",
        "omdb_genre_names",
        "tmdb_genre_names",
        "content_type",
      ].join(","),
    )
    .in("title_id", titleIds);

  if (titleError) {
    console.warn("[preferences] titles query error:", titleError.message);
    return null;
  }

  const genreWeights = new Map<string, number>();
  const contentTypeWeights = new Map<string, number>();

  for (const row of titleRows ?? []) {
    const titleId = (row as any).title_id as string | null;
    if (!titleId) continue;

    const base = titleWeights.get(titleId);
    if (base == null || base === 0) continue;

    const genres = normalizeGenres(
      (row as any).genres ??
        (row as any).omdb_genre_names ??
        (row as any).tmdb_genre_names ??
        [],
    );
    const ctRaw = (row as any).content_type as string | null;
    const ct = ctRaw ? ctRaw.toLowerCase() : null;

    for (const g of genres) {
      genreWeights.set(g, (genreWeights.get(g) ?? 0) + base);
    }

    if (ct) {
      contentTypeWeights.set(ct, (contentTypeWeights.get(ct) ?? 0) + base);
    }
  }

  if (!genreWeights.size) {
    return null;
  }

  const sortedGenres = Array.from(genreWeights.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  const favoriteGenres = sortedGenres
    .filter(([, w]) => w > 0)
    .slice(0, FAVORITE_GENRE_LIMIT)
    .map(([name]) => name);

  const dislikedGenres = sortedGenres
    .filter(([, w]) => w < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, DISLIKED_GENRE_LIMIT)
    .map(([name]) => name);

  if (!favoriteGenres.length) {
    return null;
  }

  const ctObj: Record<string, number> = {};
  for (const [ct, w] of contentTypeWeights.entries()) {
    ctObj[ct] = w;
  }

  return {
    favoriteGenres,
    dislikedGenres,
    contentTypeWeights: ctObj,
  };
}

function normalizeGenres(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v).trim().toLowerCase();
    if (!s) continue;
    out.push(s);
  }
  return out;
}
