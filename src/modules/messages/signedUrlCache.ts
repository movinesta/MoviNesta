type SignedUrlCacheEntry = {
  url: string;
  /** Epoch ms when this entry should be treated as expired */
  expiresAt: number;
};

const cache = new Map<string, SignedUrlCacheEntry>();

const now = () => Date.now();

export const getCachedSignedUrl = (path: string): string | null => {
  if (!path) return null;
  const entry = cache.get(path);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    cache.delete(path);
    return null;
  }
  return entry.url;
};

export const setCachedSignedUrl = (path: string, url: string, ttlSeconds: number): void => {
  if (!path || !url) return;

  // Refresh a bit early so we don't race expirations in the UI.
  const earlyRefreshMs = 60_000; // 1 min
  const ttlMs = Math.max(0, ttlSeconds * 1000 - earlyRefreshMs);
  cache.set(path, { url, expiresAt: now() + ttlMs });
};
