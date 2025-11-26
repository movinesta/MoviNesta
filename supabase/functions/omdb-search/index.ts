// supabase/functions/omdb-search/index.ts
// Proxy search to OMDb from the edge, so the key stays server-side.
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

type OmdbSearchRequest = {
  query: string;
  year?: number | string | null;
  type?: "movie" | "series" | "episode";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  if (!OMDB_API_KEY) {
    return new Response("OMDb not configured", { status: 500, headers: corsHeaders });
  }

  let payload: OmdbSearchRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: corsHeaders });
  }

    const rawQuery = (payload.query ?? "").trim();
    if (!rawQuery) {
      return new Response(
        JSON.stringify({ Response: "False", Error: "Empty query" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

  try {
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("apikey", OMDB_API_KEY);
    url.searchParams.set("s", rawQuery);

    // defaults to movies, but you can override via payload.type
    url.searchParams.set("type", payload.type ?? "movie");

    if (payload.year) {
      url.searchParams.set("y", String(payload.year));
    }

    const omdbRes = await fetch(url.toString());

    if (!omdbRes.ok) {
      console.error("[omdb-search] OMDb error:", omdbRes.status, await omdbRes.text());
      return new Response("OMDb upstream error", { status: 502, headers: corsHeaders });
    }

    const json = await omdbRes.json();

    // Just pass through OMDb JSON to the client.
    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[omdb-search] Unexpected error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
