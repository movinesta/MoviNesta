import { supabase } from "@/lib/supabase";

type CacheEntry = {
  url: string | null;
  expiresAt: number;
  inFlight?: Promise<string | null>;
};

// Cache signed avatar urls so message lists + profile lists don't re-request every render/poll.
// We refresh slightly early to avoid races with expiration.
const cache = new Map<string, CacheEntry>();
const now = () => Date.now();
const TTL_SECONDS = 60 * 60;
const EARLY_REFRESH_MS = 60_000; // 1 min

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const isAllowedSupabaseAvatarUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith(".supabase.co") ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
};

/**
 * profiles_public.avatar_url can be either:
 * - an http(s) URL (already usable), or
 * - a storage object path in the `avatars` bucket.
 *
 * We keep this helper in one place so profile pages, lists, and suggestions
 * render avatars consistently.
 */
export async function resolveAvatarUrl(avatarPathOrUrl: string | null): Promise<string | null> {
  if (!avatarPathOrUrl) return null;

  if (isHttpUrl(avatarPathOrUrl)) {
    return isAllowedSupabaseAvatarUrl(avatarPathOrUrl) ? avatarPathOrUrl : null;
  }

  const key = `avatars:${avatarPathOrUrl}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now()) {
    return cached.url;
  }

  if (cached?.inFlight) {
    return cached.inFlight;
  }

  const inFlight = (async (): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(avatarPathOrUrl, TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  })();

  cache.set(key, { url: null, expiresAt: 0, inFlight });

  try {
    const url = await inFlight;
    const ttlMs = Math.max(0, TTL_SECONDS * 1000 - EARLY_REFRESH_MS);
    cache.set(key, { url, expiresAt: now() + ttlMs });
    return url;
  } catch {
    cache.delete(key);
    return null;
  }
}
