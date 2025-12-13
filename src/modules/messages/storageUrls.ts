import { supabase } from "@/lib/supabase";
import { getCachedSignedUrl, setCachedSignedUrl } from "./signedUrlCache";

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

export const getPublicStorageUrl = (bucket: string, path: string): string | null => {
  if (!bucket || !path) return null;
  const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return url || null;
};

export const createSignedStorageUrl = async (
  bucket: string,
  path: string,
  ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> => {
  if (!bucket || !path) return null;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) return null;

  setCachedSignedUrl(path, data.signedUrl, ttlSeconds);
  return data.signedUrl;
};

export async function resolveStorageUrl(
  bucket: string,
  path: string,
  opts?: { ttlSeconds?: number; allowPublicFallback?: boolean; forceRefresh?: boolean },
): Promise<string | null> {
  if (!path) return null;
  if (isHttpUrl(path)) return path;

  const ttlSeconds = opts?.ttlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;
  const allowPublicFallback = opts?.allowPublicFallback ?? true;
  const forceRefresh = opts?.forceRefresh ?? false;

  if (!forceRefresh) {
    const cached = getCachedSignedUrl(path);
    if (cached) return cached;
  }

  try {
    const signed = await createSignedStorageUrl(bucket, path, ttlSeconds);
    if (signed) return signed;
  } catch {
    // ignore; fall back below
  }

  if (!allowPublicFallback) return null;

  try {
    return getPublicStorageUrl(bucket, path);
  } catch {
    return null;
  }
}

/**
 * Best-effort prefetch for UI smoothness. Never throws.
 */
export async function prefetchSignedStorageUrl(
  bucket: string,
  path: string,
  ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<void> {
  if (!path) return;
  if (isHttpUrl(path)) return;
  if (getCachedSignedUrl(path)) return;

  try {
    await createSignedStorageUrl(bucket, path, ttlSeconds);
  } catch {
    // best-effort
  }
}
