// supabase/functions/omdb-search/index.ts
// Fetch ratings for a single IMDb title from OMDb so the key stays server-side.
//
// Expects environment variable:
//   - OMDB_API_KEY

const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

if (!OMDB_API_KEY) {
  console.error("Missing OMDB_API_KEY for omdb-search function");
}

type OmdbRatingsRequest = {
  imdbId: string;
};

type OmdbRatingsResponse = {
  imdbRating: number | null;
  rtTomatoMeter: number | null;
  imdbVotes: number | null;
  metacriticScore: number | null;
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

  try {
    const payload = (await req.json().catch(() => ({}))) as OmdbRatingsRequest;
    const imdbId = (payload.imdbId ?? "").trim();

    if (!imdbId) {
      return new Response(
        JSON.stringify({ error: "Missing imdbId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!OMDB_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OMDB_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("apikey", OMDB_API_KEY);
    url.searchParams.set("i", imdbId);
    url.searchParams.set("plot", "short");

    const omdbRes = await fetch(url.toString());
    if (!omdbRes.ok) {
      console.error("[omdb-search] OMDb error:", omdbRes.status, await omdbRes.text());
      return new Response("OMDb upstream error", {
        status: 502,
        headers: corsHeaders,
      });
    }

    const json = await omdbRes.json();
    if (json.Response === "False") {
      return new Response(
        JSON.stringify({ error: json.Error ?? "Not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const imdbRating =
      json.imdbRating && json.imdbRating !== "N/A"
        ? Number(json.imdbRating)
        : null;
    const imdbVotes =
      json.imdbVotes && json.imdbVotes !== "N/A"
        ? Number(json.imdbVotes.replace(/,/g, ""))
        : null;

    let rtTomatoMeter: number | null = null;
    let metacriticScore: number | null = null;
    for (const r of json.Ratings ?? []) {
      if (r.Source === "Rotten Tomatoes") {
        const pct = r.Value?.endsWith("%")
          ? Number(r.Value.replace("%", ""))
          : null;
        rtTomatoMeter = pct;
      } else if (r.Source === "Metacritic") {
        const [scoreStr] = String(r.Value ?? "").split("/");
        const score = Number(scoreStr);
        if (!Number.isNaN(score)) {
          metacriticScore = score;
        }
      }
    }

    const payloadOut: OmdbRatingsResponse = {
      imdbRating,
      rtTomatoMeter,
      imdbVotes,
      metacriticScore,
    };

    return new Response(JSON.stringify(payloadOut), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[omdb-search] Unexpected error:", err);
    return new Response("Internal error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
