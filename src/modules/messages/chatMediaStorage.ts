import { supabase } from "@/lib/supabase";
import { CHAT_MEDIA_BUCKET } from "./chatMedia";
import { isHttpUrl } from "./storageUrls";

/**
 * Best-effort helper for deleting chat media objects.
 *
 * - Ignores empty paths
 * - Ignores full http(s) URLs
 * - Throws if Supabase reports an error
 */
export const removeChatMediaFile = async (path: string | null | undefined): Promise<void> => {
  if (!path) return;
  if (isHttpUrl(path)) return;

  const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([path]);
  if (error) throw error;
};
