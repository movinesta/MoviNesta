import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SwipeDirection = "like" | "dislike" | "skip";

interface SwipeEventPayload {
  titleId: string;
  direction: SwipeDirection;
  source?: "for-you" | "from-friends" | "trending" | string;
  rating?: number | null;
  inWatchlist?: boolean | null;
}

function buildSupabaseClient(req: Request) {
  return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabase = buildSupabaseClient(req);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: corsHeaders,
    });
  }

  let body: SwipeEventPayload;
  try {
    body = (await req.json()) as SwipeEventPayload;
  } catch {
    return new Response("Invalid JSON", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { titleId, direction, source, rating, inWatchlist } = body;

  if (!titleId || !["like", "dislike", "skip"].includes(direction)) {
    return new Response("Invalid payload", {
      status: 400,
      headers: corsHeaders,
    });
  }

  let ratingValue: number | null = rating ?? null;
  let libraryStatus: string | null = null;
  const explicitWatchlistChange = inWatchlist !== undefined && inWatchlist !== null;

  if (ratingValue === null) {
    if (direction === "like") {
      ratingValue = 4.0;
    } else if (direction === "dislike") {
      ratingValue = 1.0;
    }
  }

  if (explicitWatchlistChange) {
    libraryStatus = inWatchlist ? "want_to_watch" : null;
  } else if (direction === "like") {
    libraryStatus = "want_to_watch";
  } else if (direction === "dislike") {
    libraryStatus = "dropped";
  }

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
        console.error("[swipe-event] update library error:", updateLibError);
      }
    } else {
      const { error: insertLibError } = await supabase
        .from("library_entries")
        .insert({
          user_id: user.id,
          title_id: titleId,
          status: libraryStatus,
        });
      if (insertLibError) {
        console.error("[swipe-event] insert library error:", insertLibError);
      }
    }
  } else if (explicitWatchlistChange === true) {
    const { error: deleteLibError } = await supabase
      .from("library_entries")
      .delete()
      .eq("user_id", user.id)
      .eq("title_id", titleId);
    if (deleteLibError) {
      console.error("[swipe-event] delete library error:", deleteLibError);
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

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
