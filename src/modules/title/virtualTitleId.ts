import type { CatalogSyncPayload, CatalogSyncResponse } from "@/lib/catalogSync";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export type VirtualTitleSyncPayload = CatalogSyncPayload;

export const isUuid = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  return UUID_RE.test(value);
};

export const parseVirtualTitleId = (rawId: string): VirtualTitleSyncPayload | null => {
  if (!rawId) return null;
  if (UUID_RE.test(rawId)) return null;
  if (!rawId.startsWith("tmdb-") && !rawId.startsWith("tv-")) return null;

  const tmdbId = Number(rawId.replace(/^tmdb-/, "").replace(/^tv-/, ""));
  if (!Number.isFinite(tmdbId)) return null;

  return { tmdbId, contentType: rawId.startsWith("tv-") ? "series" : "movie" };
};

export const resolveVirtualTitleId = async (
  rawId: string,
  syncFn: (payload: VirtualTitleSyncPayload) => Promise<CatalogSyncResponse | null>,
): Promise<string | null> => {
  if (!rawId) return null;
  if (isUuid(rawId)) return rawId;

  const payload = parseVirtualTitleId(rawId);
  if (!payload) return null;

  const response = await syncFn(payload);
  if (!response?.ok) return null;
  return isUuid(response.media_item_id) ? response.media_item_id : null;
};
