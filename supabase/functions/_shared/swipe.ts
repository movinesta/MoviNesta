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
