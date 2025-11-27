// supabase/functions/refresh-genres/index.ts
// Fetch TMDB genres and upsert them into your Supabase "genres" table.
//
// Expects environment variables:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - TMDB_API_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TMDB_API_KEY) {
  console.error("Missing required environment variables for refresh-genres");
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

type TmdbGenre = {
  id: number;
  name: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=en-US`,
    );

    if (!tmdbRes.ok) {
      console.error("[refresh-genres] TMDB error:", tmdbRes.status, await tmdbRes.text());
      return new Response("TMDB error", { status: 502 });
    }

    const body = await tmdbRes.json();
    const genres = (body.genres ?? []) as TmdbGenre[];

    if (!Array.isArray(genres) || genres.length === 0) {
      console.warn("[refresh-genres] No genres returned from TMDB");
      return new Response("No genres", { status: 200 });
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
      return new Response("DB error", { status: 500 });
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[refresh-genres] Unexpected error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
