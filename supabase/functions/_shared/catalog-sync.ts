const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export type CatalogSyncTitle = {
  tmdbId?: number | null;
  imdbId?: string | null;
  contentType?: "movie" | "series" | null;
};

export async function triggerCatalogSyncForTitle(
  req: Request,
  title: CatalogSyncTitle,
  opts?: { prefix?: string },
) {
  const prefix = opts?.prefix ?? "[catalog-sync]";
  const hasExternalId = Boolean(title.tmdbId || title.imdbId);
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
      `${prefix} missing SUPABASE_URL or SUPABASE_ANON_KEY; cannot call catalog-sync`,
    );
    return;
  }

  if (!authHeader) {
    console.warn(`${prefix} no Authorization header, skipping catalog-sync`);
    return;
  }

  if (!hasExternalId) {
    console.log(`${prefix} no tmdbId/imdbId present, skipping catalog-sync`);
    return;
  }

  const type = title.contentType === "series" ? "tv" : "movie";

  const payload = {
    external: {
      tmdbId: title.tmdbId ?? undefined,
      imdbId: title.imdbId ?? undefined,
      type,
    },
    options: {
      syncOmdb: true,
      forceRefresh: false,
    },
  };

  console.log(`${prefix} calling catalog-sync for`, payload.external);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/catalog-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    const txt = await res.text().catch(() => "");
    console.log(`${prefix} catalog-sync response status=`, res.status, "body=", txt);
  } catch (err) {
    console.warn(`${prefix} catalog-sync fetch error`, err);
  }
}
