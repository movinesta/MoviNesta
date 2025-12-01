// supabase/functions/swipe-from-friends/index.ts
//
// Returns a "From Friends" swipe deck.
// Placeholder version: same as trending (you can replace the query with
// real "friends activity").
// Also triggers `catalog-sync` for up to 3 cards per call.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SwipeCard = {
  id: string;
  title: string | null;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  imdbRating: number | null;
  rtTomatoMeter: number | null;
  tmdbId: number | null;
  imdbId: string | null;
  contentType: "movie" | "series" | null;
};

type SwipeCardLike = {
  tmdbId?: number | null;
  imdbId?: string | null;
  contentType?: "movie" | "series" | null;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
};

async function triggerCatalogSyncForCards(req: Request, cards: SwipeCardLike[]) {
  console.log("[swipe-from-friends] triggerCatalogSyncForCards called, cards.length =", cards.length);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[swipe-from-friends] missing SUPABASE_URL or SUPABASE_ANON_KEY; cannot call catalog-sync");
    return;
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  console.log("[swipe-from-friends] Authorization header present:", !!authHeader);

  if (!authHeader) {
    console.warn("[swipe-from-friends] no Authorization header, skipping catalog-sync");
    return;
  }

  const candidates = cards
    .filter((c) => c.tmdbId || c.imdbId)
    .slice(0, 3);

  if (!candidates.length) {
    console.log("[swipe-from-friends] no cards with tmdbId/imdbId to sync");
    return;
  }

  console.log("[swipe-from-friends] calling catalog-sync for", candidates.length, "cards");

  await Promise.allSettled(
    candidates.map((c) => {
      const type =
        c.contentType === "series"
          ? "tv"
          : "movie";

      const payload = {
        external: {
          tmdbId: c.tmdbId ?? undefined,
          imdbId: c.imdbId ?? undefined,
          type,
        },
        options: {
          syncOmdb: true,
          forceRefresh: false,
        },
      };

      console.log("[swipe-from-friends] catalog-sync payload:", payload);

      return fetch(`${SUPABASE_URL}/functions/v1/catalog-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          const txt = await res.text().catch(() => "");
          console.log(
            "[swipe-from-friends] catalog-sync response status=",
            res.status,
            "body=",
            txt,
          );
        })
        .catch((err) => {
          console.warn("[swipe-from-friends] catalog-sync fetch error for card", c.tmdbId, err);
        });
    }),
  );
}

function getSupabaseAdminClient(req: Request) {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[swipe-from-friends] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
      return jsonError("Server misconfigured", 500);
    }

    const supabase = getSupabaseAdminClient(req);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[swipe-from-friends] auth error:", authError.message);
      return jsonError("Unauthorized", 401);
    }
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    // Placeholder: same as trending for now.
    // Replace with "friends" logic when you have your social model ready.
    const { data: rows, error: titlesError } = await supabase
      .from("titles")
      .select(
        [
          "title_id",
          "content_type",
          "tmdb_id",
          "omdb_imdb_id",
          "primary_title",
          "release_year",
          "poster_url",
          "backdrop_url",
          "imdb_rating",
          "rt_tomato_pct",
          "deleted_at",
          "tmdb_popularity",
        ].join(","),
      )
      .is("deleted_at", null)
      .order("tmdb_popularity", { ascending: false })
      .limit(50);

    if (titlesError) {
      console.error("[swipe-from-friends] titles query error:", titlesError.message);
      return jsonError("Failed to load titles", 500);
    }

    const cards: SwipeCard[] =
      (rows ?? []).map((meta: any) => ({
        id: meta.title_id,
        title: meta.primary_title ?? null,
        year: meta.release_year ?? null,
        posterUrl: meta.poster_url ?? null,
        backdropUrl: meta.backdrop_url ?? null,
        imdbRating: meta.imdb_rating ?? null,
        rtTomatoMeter: meta.rt_tomato_pct ?? null,
        tmdbId: meta.tmdb_id ?? null,
        imdbId: meta.omdb_imdb_id ?? null,
        contentType: meta.content_type ?? null,
      })) ?? [];

    await triggerCatalogSyncForCards(req, cards);

    return jsonOk(
      {
        ok: true,
        cards,
      },
      200,
    );
  } catch (err) {
    console.error("[swipe-from-friends] unhandled error:", err);
    return jsonError("Internal server error", 500);
  }
});

function jsonOk(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonOk({ ok: false, error: message }, status);
}
