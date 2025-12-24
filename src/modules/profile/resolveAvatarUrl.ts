import { supabase } from "@/lib/supabase";

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

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(avatarPathOrUrl, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
