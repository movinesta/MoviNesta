import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/supabase";

export type HomeFeedRow = {
  id: string;
  created_at: string;
  user_id: string;
  event_type: string;
  actor_profile?: Json | null;
  media_item?: Json | null;
  media_item_id?: string | null;
  payload?: Json | null;
};

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
type MediaItemRow = Database["public"]["Tables"]["media_items"]["Row"];
type ProfilePublicRow = Database["public"]["Tables"]["profiles_public"]["Row"];

type FetchHomeFeedRowsParams = {
  userId: string;
  limit: number;
  cursorCreatedAt?: string | null;
  cursorId?: string | null;
  includeExtraRow?: boolean;
};

function isHomeFeedRow(value: unknown): value is HomeFeedRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.created_at === "string" &&
    typeof row.user_id === "string" &&
    typeof row.event_type === "string"
  );
}

function normalizeString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function buildActorProfile(profile: ProfilePublicRow | null, fallbackUserId: string): Json {
  const id = normalizeString(profile?.id ?? fallbackUserId) ?? fallbackUserId;

  return {
    id,
    username: normalizeString(profile?.username),
    display_name: normalizeString(profile?.display_name),
    avatar_url: normalizeString(profile?.avatar_url),
    is_verified: normalizeBoolean(profile?.is_verified),
    verified_type: normalizeString(profile?.verified_type),
    verified_label: normalizeString(profile?.verified_label),
    verified_at: normalizeString(profile?.verified_at),
    verified_by_org: normalizeString(profile?.verified_by_org),
  };
}

async function enrichActivityRows(rows: ActivityEventRow[]): Promise<HomeFeedRow[]> {
  const mediaIds = Array.from(
    new Set(
      rows
        .map((row) => (typeof row.media_item_id === "string" ? row.media_item_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));

  const [mediaResponse, profileResponse] = await Promise.all([
    mediaIds.length
      ? supabase.from("media_items").select("*").in("id", mediaIds)
      : Promise.resolve({ data: [] as MediaItemRow[] }),
    userIds.length
      ? supabase
          .from("profiles_public")
          .select(
            "id,username,display_name,avatar_url,is_verified,verified_type,verified_label,verified_at,verified_by_org",
          )
          .in("id", userIds)
      : Promise.resolve({ data: [] as ProfilePublicRow[] }),
  ]);

  const mediaMap = new Map<string, MediaItemRow>();
  for (const item of (mediaResponse.data ?? []) as MediaItemRow[]) {
    if (item?.id) mediaMap.set(item.id, item);
  }

  const profileMap = new Map<string, ProfilePublicRow>();
  for (const profile of (profileResponse.data ?? []) as ProfilePublicRow[]) {
    if (profile?.id) {
      profileMap.set(String(profile.id), profile);
    }
  }

  return rows.map((row) => {
    const mediaItem =
      typeof row.media_item_id === "string" ? mediaMap.get(row.media_item_id) ?? null : null;
    const profile = profileMap.get(row.user_id) ?? null;

    return {
      id: row.id,
      created_at: row.created_at,
      user_id: row.user_id,
      event_type: String(row.event_type),
      actor_profile: buildActorProfile(profile, row.user_id),
      media_item: mediaItem,
      media_item_id: row.media_item_id ?? null,
      payload: row.payload,
    };
  });
}

function shouldFallbackToV1(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  const message = typeof err.message === "string" ? err.message : "";
  return (
    err.code === "42P01" ||
    message.includes("user_settings") ||
    message.includes("relation") ||
    message.includes("does not exist")
  );
}

export async function fetchHomeFeedRows({
  userId,
  limit,
  cursorCreatedAt = null,
  cursorId = null,
  includeExtraRow = false,
}: FetchHomeFeedRowsParams): Promise<{ rows: HomeFeedRow[]; usedFallback: boolean }> {
  const { data, error } = await supabase.rpc("get_home_feed_v2", {
    p_user_id: userId,
    p_limit: limit,
    p_cursor_created_at: cursorCreatedAt,
    p_cursor_id: cursorId,
  });

  if (!error) {
    const rows = (Array.isArray(data) ? data : []).filter(isHomeFeedRow);
    return { rows, usedFallback: false };
  }

  if (!shouldFallbackToV1(error)) {
    throw error;
  }

  const { data: v1Data, error: v1Error } = await supabase.rpc("get_home_feed", {
    p_user_id: userId,
    p_limit: includeExtraRow ? limit + 1 : limit,
    p_cursor: cursorCreatedAt,
  });

  if (v1Error) {
    throw v1Error;
  }

  const v1Rows = Array.isArray(v1Data) ? (v1Data as ActivityEventRow[]) : [];
  const enriched = await enrichActivityRows(v1Rows);
  return { rows: enriched.filter(isHomeFeedRow), usedFallback: true };
}
