export type CatalogSyncContentType = "movie" | "series";

export type CatalogSyncPayload = {
  tmdbId: number;
  contentType: CatalogSyncContentType;
};

export type CatalogSyncResponse = {
  ok: true;
  media_item_id: string;
  kind: CatalogSyncContentType;
  tmdb_id: number | null;
  omdb_imdb_id: string | null;
};

export const isCatalogSyncResponse = (value: unknown): value is CatalogSyncResponse => {
  if (!value || typeof value !== "object") return false;
  const res = value as CatalogSyncResponse;
  return Boolean(
    res.ok === true && typeof res.media_item_id === "string" && typeof res.kind === "string",
  );
};
