import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { log } from "../_shared/logger.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
  validateRequest,
} from "../_shared/http.ts";
import { getUserClient, getAdminClient } from "../_shared/supabase.ts";

function buildSupabaseClient(req: Request) {
  return getAdminClient(req);
}


type SwipeDirection = "like" | "dislike" | "skip";

interface SwipeEventPayload {
  titleId: string;
  direction: SwipeDirection;
  source?: "for-you" | "from-friends" | "trending" | string;
  rating?: number | null;
  inWatchlist?: boolean | null;
}
const SwipeEventSchema = z.object({
  titleId: z.string().min(1),
  direction: z.enum(["like", "dislike", "skip"]),
  source: z
    .union([
      z.literal("for-you"),
      z.literal("from-friends"),
      z.literal("trending"),
      z.string(),
    ])
    .optional(),
  rating: z.number().min(0).max(10).nullable().optional(),
  inWatchlist: z.boolean().nullable().optional(),
});

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = getUserClient(req);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const validation = await validateRequest<SwipeEventPayload>(
      req,
      (raw) => SwipeEventSchema.parse(raw) as SwipeEventPayload,
      { logPrefix: "[swipe-event]" },
    );

    if (validation.errorResponse) return validation.errorResponse;

    const body = validation.data;

    const { titleId, direction, source, rating, inWatchlist } = body;

    let ratingValue: number | null = rating ?? null;
    let libraryStatus: string | null = null;
    const explicitWatchlistChange =
      inWatchlist !== undefined && inWatchlist !== null;

    if (ratingValue === null) {
      // Pick sensible defaults on a 0–10 scale when the client does not send
      // an explicit rating. These roughly correspond to:
      //   like    → 8.0
      //   dislike → 3.0
      //   skip    → 5.0 (neutral)
      if (direction === "like") {
        ratingValue = 8.0;
      } else if (direction === "dislike") {
        ratingValue = 3.0;
      } else if (direction === "skip") {
        ratingValue = 5.0;
      }
    }

    // Normalize rating to the 0–10 range accepted by the DB (half‑step increments).
    // Defensive in case a client sends bad data.
    if (ratingValue !== null) {
      ratingValue = Math.max(0, Math.min(10, ratingValue));
    }

    if (explicitWatchlistChange) {
      libraryStatus = inWatchlist ? "want_to_watch" : null;
    } else if (direction === "like") {
      libraryStatus = "want_to_watch";
    } else if (direction === "dislike") {
      libraryStatus = "dropped";
    }

    const { data: titleRow, error: titleError } = await supabase
      .from("titles")
      .select("content_type, tmdb_id, omdb_imdb_id")
      .eq("title_id", titleId)
      .maybeSingle();

    if (titleError) {
      console.error("[swipe-event] select title error:", titleError);
      return jsonResponse({ error: "Failed to load title" }, 500);
    }

    if (!titleRow?.content_type) {
      return jsonResponse({ error: "Title not found" }, 404);
    }

    const contentType = titleRow.content_type;

    // Kick off catalog-sync in the background so a swipe is not blocked on
    // TMDb/OMDb network calls.
    triggerCatalogSyncForTitle(
      req,
      {
        tmdbId: titleRow.tmdb_id ?? undefined,
        imdbId: titleRow.omdb_imdb_id ?? undefined,
        contentType,
      },
      { prefix: "[swipe-event]" },
    );

    if (ratingValue !== null) {
      const { data: existingRating, error: selectRatingError } = await supabase
        .from("ratings")
        .select("id")
        .eq("user_id", user.id)
        .eq("title_id", titleId)
        .maybeSingle();

      if (selectRatingError && selectRatingError.code !== "PGRST116") {
        console.error("[swipe-event] select ratings error:", selectRatingError);
      }

      if (existingRating?.id) {
        const { error: updateRatingError } = await supabase
          .from("ratings")
          .update({
            rating: ratingValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRating.id);
        if (updateRatingError) {
          console.error("[swipe-event] update rating error:", updateRatingError);
        }
      } else {
        const { error: insertRatingError } = await supabase
          .from("ratings")
          .insert({
            user_id: user.id,
            title_id: titleId,
            content_type: contentType,
            rating: ratingValue,
          });
        if (insertRatingError) {
          console.error("[swipe-event] insert rating error:", insertRatingError);
        }
      }
    }

    if (libraryStatus !== null) {
      const { data: existingEntry, error: selectLibError } = await supabase
        .from("library_entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("title_id", titleId)
        .maybeSingle();

      if (selectLibError && selectLibError.code !== "PGRST116") {
        console.error("[swipe-event] select library error:", selectLibError);
      }

      if (existingEntry?.id) {
        const { error: updateLibError } = await supabase
          .from("library_entries")
          .update({
            status: libraryStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingEntry.id);
        if (updateLibError) {
          console.error("[swipe-event] update library error:", { userId: user.id, titleId, error: updateLibError });
        }
      } else {
        const { error: insertLibError } = await supabase
          .from("library_entries")
          .insert({
            user_id: user.id,
            title_id: titleId,
            content_type: contentType,
            status: libraryStatus,
          });
        if (insertLibError) {
          console.error("[swipe-event] insert library error:", { userId: user.id, titleId, error: insertLibError });
        }
      }
    } else if (explicitWatchlistChange === true) {
      const { error: deleteLibError } = await supabase
        .from("library_entries")
        .delete()
        .eq("user_id", user.id)
        .eq("title_id", titleId);
      if (deleteLibError) {
        console.error("[swipe-event] delete library error:", { userId: user.id, titleId, error: deleteLibError });
      }
    }

    const eventType =
      direction === "skip" ? "swipe_skipped" : "rating_created";

    const { error: activityError } = await supabase
      .from("activity_events")
      .insert({
        user_id: user.id,
        title_id: titleId,
        event_type: eventType,
        payload: {
          source: source ?? "swipe",
          direction,
          rating: ratingValue,
          watchlist: explicitWatchlistChange ? inWatchlist : undefined,
        },
      });

    if (activityError) {
      console.error("[swipe-event] activity_events error:", activityError);
    }

    // Keep denormalized stats tables in sync with this interaction.
    const adminClient = buildSupabaseClient(req);
    await Promise.allSettled([
      updateTitleStats(adminClient, titleId),
      updateUserStats(adminClient, user.id),
    ]);

    return jsonResponse({ ok: true });

  } catch (err) {
    console.error("[swipe-event] unhandled error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonError(message, 500, "INTERNAL_ERROR");
  }
});



async function updateTitleStats(
  supabase: ReturnType<typeof buildSupabaseClient>,
  titleId: string,
): Promise<void> {
  try {
    // Aggregate ratings for this title
    const { data: ratingAgg, error: ratingAggError } = await supabase
      .from("ratings")
      .select("avg(rating)::numeric as avg_rating, count(*)::int as ratings_count")
      .eq("title_id", titleId)
      .single();

    if (ratingAggError) {
      console.warn("[swipe-event] updateTitleStats ratings agg error:", ratingAggError.message);
    }

    const { data: reviewAgg, error: reviewAggError } = await supabase
      .from("reviews")
      .select("count(*)::int as reviews_count")
      .eq("title_id", titleId)
      .single();

    if (reviewAggError) {
      console.warn("[swipe-event] updateTitleStats reviews agg error:", reviewAggError.message);
    }

    // For watch_count we approximate "has some non-want_to_watch entry"
    const { count: watchCount, error: watchAggError } = await supabase
      .from("library_entries")
      .select("*", { count: "exact", head: true })
      .eq("title_id", titleId)
      .neq("status", "want_to_watch");

    if (watchAggError) {
      console.warn("[swipe-event] updateTitleStats watch agg error:", watchAggError.message);
    }

    const now = new Date().toISOString();

    const avgRating = (ratingAgg as any)?.avg_rating ?? null;
    const ratingsCount = (ratingAgg as any)?.ratings_count ?? 0;
    const reviewsCount = (reviewAgg as any)?.reviews_count ?? 0;
    const watchCount = watchCount ?? 0;

    await supabase
      .from("title_stats")
      .upsert(
        {
          title_id: titleId,
          avg_rating: avgRating,
          ratings_count: ratingsCount,
          reviews_count: reviewsCount,
          watch_count: watchCount,
          last_updated_at: now,
        },
        { onConflict: "title_id" },
      );
  } catch (err) {
    console.warn("[swipe-event] updateTitleStats unexpected error:", err);
  }
}

async function updateUserStats(
  supabase: ReturnType<typeof buildSupabaseClient>,
  userId: string,
): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Ratings
    const { data: ratingsAgg, error: ratingsAggError } = await supabase
      .from("ratings")
      .select("count(*)::int as ratings_count")
      .eq("user_id", userId)
      .single();

    if (ratingsAggError) {
      console.warn("[swipe-event] updateUserStats ratings agg error:", ratingsAggError.message);
    }

    const { data: reviewsAgg, error: reviewsAggError } = await supabase
      .from("reviews")
      .select("count(*)::int as reviews_count")
      .eq("user_id", userId)
      .single();

    if (reviewsAggError) {
      console.warn("[swipe-event] updateUserStats reviews agg error:", reviewsAggError.message);
    }

    const { data: watchlistAgg, error: watchlistAggError } = await supabase
      .from("library_entries")
      .select("count(*)::int as watchlist_count")
      .eq("user_id", userId)
      .eq("status", "want_to_watch")
      .single();

    if (watchlistAggError) {
      console.warn("[swipe-event] updateUserStats watchlist agg error:", watchlistAggError.message);
    }

    const { data: commentsAgg, error: commentsAggError } = await supabase
      .from("comments")
      .select("count(*)::int as comments_count")
      .eq("user_id", userId)
      .single();

    if (commentsAggError) {
      console.warn("[swipe-event] updateUserStats comments agg error:", commentsAggError.message);
    }

    const { count: listsCountRaw, error: listsAggError } = await supabase
      .from("lists")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (listsAggError) {
      console.warn("[swipe-event] updateUserStats lists agg error:", listsAggError.message);
    }

    const { count: messagesSentCountRaw, error: messagesAggError } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (messagesAggError) {
      console.warn("[swipe-event] updateUserStats messages agg error:", messagesAggError.message);
    }

    const ratingsCount = (ratingsAgg as any)?.ratings_count ?? 0;
    const reviewsCount = (reviewsAgg as any)?.reviews_count ?? 0;
    const watchlistCount = (watchlistAgg as any)?.watchlist_count ?? 0;
    const commentsCount = (commentsAgg as any)?.comments_count ?? 0;
    const listsCount = (listsAgg as any)?.count ?? 0;
    const messagesSentCount = (messagesAgg as any)?.count ?? 0;

    await supabase
      .from("user_stats")
      .upsert(
        {
          user_id: userId,
          ratings_count: ratingsCount,
          reviews_count: reviewsCount,
          watchlist_count: watchlistCount,
          comments_count: commentsCount,
          lists_count: listsCount,
          messages_sent_count: messagesSentCount,
          last_active_at: now,
        },
        { onConflict: "user_id" },
      );
  } catch (err) {
    console.warn("[swipe-event] updateUserStats unexpected error:", err);
  }
}

