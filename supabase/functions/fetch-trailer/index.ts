// supabase/functions/fetch-trailer/index.ts
// Look up a YouTube trailer for a given title (and optional year).
//
// Expects environment variable:
// - YOUTUBE_API_KEY

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

if (!YOUTUBE_API_KEY) {
  console.error("Missing YOUTUBE_API_KEY for fetch-trailer");
}

type RequestBody = {
  title: string;
  year?: number | string | null;
};

type YoutubeSearchItem = {
  id?: {
    videoId?: string;
  };
};

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

  if (!YOUTUBE_API_KEY) {
    return new Response("YouTube API not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  let payload: RequestBody;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: corsHeaders });
  }

  const { title, year } = payload;

  if (!title || typeof title !== "string") {
    return new Response("Missing 'title' in body", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const queryParts = [title.trim(), "official trailer"];
  if (year) {
    queryParts.push(String(year));
  }
  const q = queryParts.join(" ");

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("q", q);
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const ytRes = await fetch(url.toString());

    if (!ytRes.ok) {
      console.error("[fetch-trailer] YouTube error:", ytRes.status, await ytRes.text());
      return new Response("YouTube error", { status: 502, headers: corsHeaders });
    }

    const json = await ytRes.json();
    const items: YoutubeSearchItem[] = json.items ?? [];
    const first = items[0];

    const videoId = first?.id?.videoId ?? null;

    const responseBody = {
      videoId,
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
      query: q,
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fetch-trailer] Unexpected error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
