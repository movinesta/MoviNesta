import { getConfig } from "./config.ts";

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
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  const prefix = opts?.prefix ?? "[catalog-sync]";
  const hasExternalId = Boolean(title.tmdbId || title.imdbId);
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
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
    const res = await fetch(`${supabaseUrl}/functions/v1/catalog-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
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
