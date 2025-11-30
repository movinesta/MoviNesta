import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SwipeCardData = {
  id: string;
  title: string;
  year?: number | null;
  runtimeMinutes?: number | null;
  tagline?: string | null;
  mood?: string | null;
  vibeTag?: string | null;
  type?: string | null;
  posterUrl?: string | null;
  friendLikesCount?: number | null;
  topFriendName?: string | null;
  topFriendInitials?: string | null;
  topFriendReviewSnippet?: string | null;
  initialRating?: number | null;
  initiallyInWatchlist?: boolean;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
};

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

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars");
    return new Response(JSON.stringify({ cards: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = buildSupabaseClient(req);

  // Get current user
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

  // Read limit from body (optional)
  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 100) : 100;

  // 1) Get friends: people the current user follows
  const { data: follows, error: followsError } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", user.id);

  if (followsError) {
    console.error("[swipe-from-friends] followsError:", followsError);
    return new Response(JSON.stringify({ cards: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const friendIds = (follows ?? [])
    .map((f: any) => f.followed_id as string | null)
    .filter(Boolean) as string[];

  if (!friendIds.length) {
    // No friends → no friend-based cards
    return new Response(JSON.stringify({ cards: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2) Get friend ratings (high ratings only)
  const { data: friendRatings, error: ratingsError } = await supabase
    .from("ratings")
    .select("title_id, rating, user_id, created_at")
    .in("user_id", friendIds)
    .gte("rating", 3.5)
    .order("created_at", { ascending: false })
    .limit(250); // a bit more than limit so we can dedupe

  if (ratingsError) {
    console.error("[swipe-from-friends] ratingsError:", ratingsError);
    return new Response(JSON.stringify({ cards: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!friendRatings || friendRatings.length === 0) {
    // friends exist but haven't rated anything highly
    return new Response(JSON.stringify({ cards: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3) Get friend profiles (for names/initials)
  const uniqueFriendIds = Array.from(
    new Set(friendRatings.map((r: any) => r.user_id as string)),
  );

  const { data: friendProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", uniqueFriendIds);

  if (profilesError) {
    console.error("[swipe-from-friends] profilesError:", profilesError);
  }

  const profilesById = new Map<
    string,
    { id: string; display_name: string | null; username: string | null }
  >(
    (friendProfiles ?? []).map((p: any) => [
      p.id as string,
      {
        id: p.id as string,
        display_name: (p.display_name as string | null) ?? null,
        username: (p.username as string | null) ?? null,
      },
    ]),
  );

  // 4) Group by title_id → which friends liked each title
  type FriendGroup = {
    titleId: string;
    friendIds: string[];
  };

  const groupByTitle = new Map<string, FriendGroup>();

  for (const r of friendRatings) {
    const titleId = r.title_id as string | null;
    const friendId = r.user_id as string | null;
    if (!titleId || !friendId) continue;

    const existing = groupByTitle.get(titleId);
    if (!existing) {
      groupByTitle.set(titleId, {
        titleId,
        friendIds: [friendId],
      });
    } else if (!existing.friendIds.includes(friendId)) {
      existing.friendIds.push(friendId);
    }
  }

  const titleIds = Array.from(groupByTitle.keys());

  if (!titleIds.length) {
    return new Response(JSON.stringify({ cards: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 5) Fetch title details
  const { data: titles, error: titlesError } = await supabase
    .from("titles")
    .select(
      `
      title_id,
      primary_title,
      release_year,
      content_type,
      poster_url,
      backdrop_url,
      runtime_minutes,
      plot,
      imdb_rating,
      omdb_rt_rating_pct
    `,
    )
    .in("title_id", titleIds);

  if (titlesError) {
    console.error("[swipe-from-friends] titlesError:", titlesError);
    return new Response(JSON.stringify({ cards: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const titleRows = (titles ?? []) as any[];

  // 6) Build cards (limit)
  const cards: SwipeCardData[] = [];

  for (const row of titleRows) {
    const group = groupByTitle.get(row.title_id as string);
    if (!group) continue;

    const friendCount = group.friendIds.length;
    const topFriendId = group.friendIds[0];
    const topProfile = profilesById.get(topFriendId);

    const displayName =
      topProfile?.display_name ||
      topProfile?.username ||
      "A friend";

    const initials = displayName
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const synopsis: string | null = row.plot ?? null;
    const shortTagline =
      synopsis && synopsis.length > 110
        ? synopsis.slice(0, 107) + "…"
        : synopsis;

    cards.push({
      id: row.title_id as string,
      title: (row.primary_title as string | null) ?? "Untitled",
      year: (row.release_year as number | null) ?? null,
      runtimeMinutes: (row.runtime_minutes as number | null) ?? null,
      tagline: shortTagline,
      mood: null,
      vibeTag: null,
      type: (row.content_type as string | null) ?? null,
      posterUrl: (row.poster_url as string | null) ?? (row.backdrop_url as string | null) ?? null,
      friendLikesCount: friendCount,
      topFriendName: displayName,
      topFriendInitials: initials,
      topFriendReviewSnippet: null,
      initialRating: null,
      initiallyInWatchlist: false,
      imdbRating: (row.imdb_rating as number | null) ?? null,
      rtTomatoMeter: (row.omdb_rt_rating_pct as number | null) ?? null,
    });

    if (cards.length >= limit) break;
  }

  return new Response(JSON.stringify({ cards }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
