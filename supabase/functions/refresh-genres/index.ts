// supabase/functions/refresh-genres/index.ts
// Fetch TMDB genres and upsert them into your Supabase "genres" table.
//
// Expects environment variables:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - TMDB_API_READ_ACCESS_TOKEN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TMDB_READ_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TMDB_READ_TOKEN) {
  console.error("Missing required environment variables for refresh-genres");
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

type TmdbGenre = {
  id: number;
  name: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const tmdbRes = await fetch(`https://api.themoviedb.org/3/genre/movie/list?language=en-US`, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${TMDB_READ_TOKEN}`,
      },
    });

    if (!tmdbRes.ok) {
      console.error("[refresh-genres] TMDB error:", tmdbRes.status, await tmdbRes.text());
      return new Response("TMDB error", { status: 502, headers: corsHeaders });
    }

    const body = await tmdbRes.json();
    const genres = (body.genres ?? []) as TmdbGenre[];

    if (!Array.isArray(genres) || genres.length === 0) {
      console.warn("[refresh-genres] No genres returned from TMDB");
      return new Response("No genres", { status: 200, headers: corsHeaders });
    }

    // Adjust the table / column names if your schema is different.
    // Assumed schema:
    //   table: genres
    //   columns: id (PK, uuid or serial), tmdb_id (int, unique), name (text)
    const { error } = await supabase.from("genres").upsert(
      genres.map((g) => ({
        tmdb_id: g.id,
        name: g.name,
      })),
      { onConflict: "tmdb_id" },
    );

    if (error) {
      console.error("[refresh-genres] Supabase upsert error:", error);
      return new Response("DB error", { status: 500, headers: corsHeaders });
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[refresh-genres] Unexpected error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
