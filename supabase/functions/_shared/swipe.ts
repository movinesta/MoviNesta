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

  // Ratings: any title the user has rated.
  try {
    const { data: ratings, error: ratingsError } = await supabase
      .from("ratings")
      .select("title_id")
      .eq("user_id", userId)
      .limit(limit);

    if (ratingsError) {
      console.warn("[swipe:seen] ratings error", ratingsError);
    } else if (Array.isArray(ratings)) {
      for (const row of ratings) {
        if (row?.title_id) {
          seen.add(row.title_id as string);
        }
      }
    }
  } catch (err) {
    console.warn("[swipe:seen] ratings fetch failed", err);
  }

  // Library entries: anything on watchlist / in history.
  try {
    const { data: libraryRows, error: libError } = await supabase
      .from("library_entries")
      .select("title_id")
      .eq("user_id", userId)
      .limit(limit);

    if (libError) {
      console.warn("[swipe:seen] library_entries error", libError);
    } else if (Array.isArray(libraryRows)) {
      for (const row of libraryRows) {
        if (row?.title_id) {
          seen.add(row.title_id as string);
        }
      }
    }
  } catch (err) {
    console.warn("[swipe:seen] library_entries fetch failed", err);
  }

  // Activity events: swipes and rating-created events.
  try {
    const { data: activityRows, error: activityError } = await supabase
      .from("activity_events")
      .select("title_id, event_type")
      .eq("user_id", userId)
      .in("event_type", ["rating_created", "swipe_skipped"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (activityError) {
      console.warn("[swipe:seen] activity_events error", activityError);
    } else if (Array.isArray(activityRows)) {
      for (const row of activityRows) {
        if (row?.title_id) {
          seen.add(row.title_id as string);
        }
      }
    }
  } catch (err) {
    console.warn("[swipe:seen] activity_events fetch failed", err);
  }

  return seen;
}
