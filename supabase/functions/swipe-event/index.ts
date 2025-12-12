// supabase/functions/swipe-event/index.ts
//
// Handles a user swipe action ("like", "dislike", "skip") on a title.
// This function is responsible for:
// - Creating or updating a user's rating for the title.
// - Adding or updating the title's status in the user's library.
// - Recording an activity event for the user's feed.
// - Triggering updates for denormalized title and user stats.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "swipe-event";

// ============================================================================
// Type Definitions
// ============================================================================

type ContentType = Database["public"]["Enums"]["content_type"];
type LibraryStatus = Database["public"]["Enums"]["library_status"];
type ActivityEventType = Database["public"]["Enums"]["activity_event_type"];

const SwipeEventSchema = z.object({
  titleId: z.string().uuid("Invalid title ID"),
  direction: z.enum(["like", "dislike", "skip"]),
  source: z.string().optional(),
  rating: z.number().min(0).max(10).optional().nullable(),
  inWatchlist: z.boolean().optional().nullable(),
});

type SwipeEventPayload = z.infer<typeof SwipeEventSchema>;

// ============================================================================
// Main Request Handler
// ============================================================================

export async function handler(req: Request){
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

  try {
    const supabase = getUserClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      log(logCtx, "Authentication error", { error: authError?.message });
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const { data: payload, errorResponse } = await validateRequest<SwipeEventPayload>(req, (raw) =>
      SwipeEventSchema.parse(raw)
    );
    if (errorResponse) return errorResponse;

    const { titleId } = payload;
    const { data: title, error: titleError } = await supabase
      .from("titles")
      .select("content_type")
      .eq("title_id", titleId)
      .single();

    if (titleError || !title) {
      log(logCtx, "Title not found", { titleId, error: titleError?.message });
      return jsonError("Title not found", 404, "TITLE_NOT_FOUND");
    }

    await Promise.all([
      handleRatingUpdate(supabase, user.id, title.content_type, payload),
      handleLibraryUpdate(supabase, user.id, title.content_type, payload),
      recordActivityEvent(supabase, user.id, payload),
    ]);

    // Denormalized stats updates are critical but can run in the background.
    const adminClient = getAdminClient();
    Promise.allSettled([
      updateTitleStats(adminClient, titleId),
      updateUserStats(adminClient, user.id),
    ]);

    log(logCtx, "Swipe event processed successfully", { userId: user.id, titleId });
    return jsonResponse({ ok: true });
  } catch (err) {
    log(logCtx, "Unhandled error", { error: err.message, stack: err.stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);

// ============================================================================
// Core Logic Helpers
// ============================================================================

async function handleRatingUpdate(
  supabase: SupabaseClient<Database>,
  userId: string,
  contentType: ContentType,
  payload: SwipeEventPayload,
) {
  const { titleId, direction, rating } = payload;
  let ratingValue = rating;

  if (ratingValue === undefined || ratingValue === null) {
    if (direction === "like") ratingValue = 8.0;
    else if (direction === "dislike") ratingValue = 3.0;
  }

  if (ratingValue !== null && ratingValue !== undefined) {
    const { error } = await supabase.from("ratings").upsert(
      {
        user_id: userId,
        title_id: titleId,
        content_type: contentType,
        rating: Math.round(ratingValue * 2) / 2,
      },
      { onConflict: "user_id, title_id" },
    );
    if (error) {
      log({ fn: FN_NAME }, "Failed to upsert rating", { userId, titleId, error: error.message });
    }
  }
}

async function handleLibraryUpdate(
  supabase: SupabaseClient<Database>,
  userId: string,
  contentType: ContentType,
  payload: SwipeEventPayload,
) {
  const { titleId, direction, inWatchlist } = payload;
  let status: LibraryStatus | null = null;

  if (typeof inWatchlist === "boolean") {
    status = inWatchlist ? "want_to_watch" : null;
  } else if (direction === "like") {
    status = "want_to_watch";
  } else if (direction === "dislike") {
    status = "dropped";
  }

  if (status) {
    const { error } = await supabase.from("library_entries").upsert(
      { user_id: userId, title_id: titleId, content_type: contentType, status },
      { onConflict: "user_id, title_id" },
    );
    if (error) {
      log({ fn: FN_NAME }, "Upsert library entry failed", { userId, titleId, error: error.message });
    }
  } else if (inWatchlist === false) {
    const { error } = await supabase.from("library_entries").delete().match({ user_id: userId, title_id: titleId });
    if (error) {
      log({ fn: FN_NAME }, "Delete library entry failed", { userId, titleId, error: error.message });
    }
  }
}

async function recordActivityEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  payload: SwipeEventPayload,
) {
  const { titleId, direction, source, rating, inWatchlist } = payload;
  const event_type: ActivityEventType = direction === "skip" ? "swipe_skipped" : "rating_created";

  const { error } = await supabase.from("activity_events").insert({
    user_id: userId,
    title_id: titleId,
    event_type,
    payload: { source: source ?? "swipe", direction, rating, watchlist: inWatchlist },
  });
  if (error) {
    log({ fn: FN_NAME }, "Failed to record activity event", { userId, titleId, error: error.message });
  }
}

// ============================================================================
// Denormalized Stats Updaters
// ============================================================================

async function updateTitleStats(supabase: SupabaseClient<Database>, titleId: string) {
  const logCtx = { fn: FN_NAME, titleId };
  try {
    const { data: ratings, error: ratingError } = await supabase
      .from("ratings")
      .select("rating")
      .eq("title_id", titleId);

    if (ratingError) throw ratingError;

    const ratingsCount = ratings.length;
    const avgRating = ratingsCount > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratingsCount
      : null;

    const { count: reviewsCount, error: reviewsError } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .eq("title_id", titleId);
    if (reviewsError) throw reviewsError;

    const { count: watchCount, error: watchError } = await supabase
      .from("library_entries")
      .select("*", { count: "exact", head: true })
      .eq("title_id", titleId)
      .neq("status", "want_to_watch");
    if (watchError) throw watchError;

    const { error: upsertError } = await supabase.from("title_stats").upsert(
      {
        title_id: titleId,
        avg_rating: avgRating,
        ratings_count: ratingsCount,
        reviews_count: reviewsCount ?? 0,
        watch_count: watchCount ?? 0,
      },
      { onConflict: "title_id" },
    );
    if (upsertError) throw upsertError;
  } catch (err) {
    log(logCtx, "Failed to update title stats", { error: err.message });
  }
}

async function updateUserStats(supabase: SupabaseClient<Database>, userId: string) {
  const logCtx = { fn: FN_NAME, userId };
  try {
    const tables: (keyof Database["public"]["Tables"])[] = [
      "ratings",
      "reviews",
      "comments",
      "lists",
      "messages",
    ];
    const counts = await Promise.all(
      tables.map((table) =>
        supabase.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId)
      ),
    );

    const [
      { count: ratingsCount },
      { count: reviewsCount },
      { count: commentsCount },
      { count: listsCount },
      { count: messagesSentCount },
    ] = counts.map((res, i) => {
      if (res.error) {
        log(logCtx, `Failed to count ${tables[i]}`, { error: res.error.message });
      }
      return { count: res.count ?? 0 };
    });

    const { count: watchlistCount, error: watchlistError } = await supabase
      .from("library_entries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "want_to_watch");
    if (watchlistError) {
      log(logCtx, "Failed to count watchlist", { error: watchlistError.message });
    }

    const { error: upsertError } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        ratings_count: ratingsCount,
        reviews_count: reviewsCount,
        watchlist_count: watchlistCount ?? 0,
        comments_count: commentsCount,
        lists_count: listsCount,
        messages_sent_count: messagesSentCount,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upsertError) throw upsertError;
  } catch (err) {
    log(logCtx, "Failed to update user stats", { error: err.message });
  }
}
