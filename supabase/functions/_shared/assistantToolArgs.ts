// supabase/functions/_shared/assistantToolArgs.ts
//
// Shared helpers for normalizing assistant tool arguments and inferring missing
// context from user-facing text. This file is dependency-free and safe for
// Supabase Edge (Deno) runtimes.

type UnknownRecord = Record<string, unknown>;

export function coerceArgString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = coerceArgString(v);
    if (s) return s;
  }
  return "";
}

export function normalizeListName(value: string): string {
  const raw = coerceArgString(value);
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^[\"“”']+/, "")
    .replace(/[\\"“”']+$/, "")
    .replace(/[\.!?,;:]+$/g, "")
    .trim();
}

function normalizeContentType(value: unknown): string {
  const raw = coerceArgString(value);
  return raw ? raw.toLowerCase() : "";
}

function normalizeItem(item: unknown, fallbackContentType?: unknown): UnknownRecord | null {
  if (!item) return null;
  if (typeof item === "string") {
    const titleId = coerceArgString(item);
    return titleId ? { titleId } : null;
  }
  if (typeof item !== "object" || Array.isArray(item)) return null;
  const obj = item as UnknownRecord;
  const mapped: UnknownRecord = { ...obj };
  const titleId = pickString(
    obj.titleId,
    (obj as any).title_id,
    obj.id,
    (obj as any).media_item_id,
    (obj as any).title?.id,
    (obj as any).title?.titleId,
    (obj as any).title?.title_id,
    (obj as any).title?.media_item_id,
  );
  if (titleId) mapped.titleId = titleId;

  if (!mapped.contentType) {
    const contentType = normalizeContentType(
      obj.contentType ??
        (obj as any).content_type ??
        (obj as any).kind ??
        (obj as any).type ??
        (obj as any).title?.contentType ??
        (obj as any).title?.content_type ??
        (obj as any).title?.kind ??
        (obj as any).title?.type ??
        fallbackContentType,
    );
    if (contentType) mapped.contentType = contentType;
  }

  return mapped;
}

export function normalizeToolArgs(tool: string, args: UnknownRecord = {}): UnknownRecord {
  const normalized: UnknownRecord = { ...(args ?? {}) };
  const toolName = String(tool ?? "");

  if (toolName.startsWith("list_") || toolName === "get_list_items" || toolName === "list_delete") {
    const listId = pickString(
      normalized.listId,
      (normalized as any).list_id,
      (normalized as any).listID,
      (normalized as any).list?.id,
      (normalized as any).list?.listId,
      (normalized as any).list?.list_id,
      (normalized as any).list?.listID,
    );
    if (listId) normalized.listId = listId;

    const listName = normalizeListName(
      pickString(normalized.listName, (normalized as any).list_name, (normalized as any).name, (normalized as any).list?.name),
    );
    if (listName) normalized.listName = listName;
  }

  if (toolName === "list_add_item") {
    const titleId = pickString(
      normalized.titleId,
      (normalized as any).title_id,
      (normalized as any).id,
      (normalized as any).media_item_id,
      (normalized as any).title?.id,
      (normalized as any).title?.titleId,
      (normalized as any).title?.title_id,
      (normalized as any).title?.media_item_id,
    );
    if (titleId) normalized.titleId = titleId;

    if (!normalized.contentType) {
      const contentType = normalizeContentType(
        (normalized as any).contentType ?? (normalized as any).content_type ?? (normalized as any).kind ?? (normalized as any).type,
      );
      if (contentType) normalized.contentType = contentType;
    }
  }

  if (toolName === "list_add_items") {
    const titleId = pickString(
      (normalized as any).titleId,
      (normalized as any).title_id,
      (normalized as any).id,
      (normalized as any).media_item_id,
      (normalized as any).title?.id,
      (normalized as any).title?.titleId,
      (normalized as any).title?.title_id,
      (normalized as any).title?.media_item_id,
    );
    if (titleId) (normalized as any).titleId = titleId;

    if (!Array.isArray((normalized as any).titleIds) && Array.isArray((normalized as any).title_ids)) {
      (normalized as any).titleIds = (normalized as any).title_ids;
    }

    if (Array.isArray((normalized as any).items)) {
      (normalized as any).items = (normalized as any).items
        .map((item: unknown) => normalizeItem(item, (normalized as any).contentType ?? (normalized as any).content_type))
        .filter(Boolean);
    }

    if (!(normalized as any).contentType) {
      const contentType = normalizeContentType(
        (normalized as any).contentType ?? (normalized as any).content_type ?? (normalized as any).kind ?? (normalized as any).type,
      );
      if (contentType) (normalized as any).contentType = contentType;
    }

    if (!Array.isArray((normalized as any).titleIds) && (normalized as any).titleId) {
      const tid = coerceArgString((normalized as any).titleId);
      if (tid) (normalized as any).titleIds = [tid];
    }
  }

  if (toolName === "create_list") {
    if (Array.isArray((normalized as any).items)) {
      (normalized as any).items = (normalized as any).items
        .map((item: unknown) => normalizeItem(item, (normalized as any).contentType ?? (normalized as any).content_type))
        .filter(Boolean);
    }
  }

  if (toolName === "list_remove_item") {
    const itemId = pickString(
      (normalized as any).itemId,
      (normalized as any).item_id,
      (normalized as any).list_item_id,
      (normalized as any).id,
    );
    if (itemId) (normalized as any).itemId = itemId;

    const titleId = pickString(
      (normalized as any).titleId,
      (normalized as any).title_id,
      (normalized as any).media_item_id,
      (normalized as any).title?.id,
      (normalized as any).title?.titleId,
      (normalized as any).title?.title_id,
      (normalized as any).title?.media_item_id,
    );
    if (titleId) (normalized as any).titleId = titleId;
  }

  if (toolName === "list_set_visibility") {
    if (!(normalized as any).isPublic && (normalized as any).is_public !== undefined) {
      (normalized as any).isPublic = Boolean((normalized as any).is_public);
    }
  }

  if (toolName === "diary_set_status" || toolName === "rate_title" || toolName === "review_upsert" || toolName === "rating_delete" || toolName === "review_delete") {
    const titleId = pickString(
      (normalized as any).titleId,
      (normalized as any).title_id,
      (normalized as any).media_item_id,
      (normalized as any).id,
      (normalized as any).title?.id,
      (normalized as any).title?.titleId,
      (normalized as any).title?.title_id,
      (normalized as any).title?.media_item_id,
    );
    if (titleId) (normalized as any).titleId = titleId;

    if (!(normalized as any).contentType) {
      const contentType = normalizeContentType(
        (normalized as any).contentType ?? (normalized as any).content_type ?? (normalized as any).kind ?? (normalized as any).type,
      );
      if (contentType) (normalized as any).contentType = contentType;
    }
  }

  if (toolName === "follow_user" || toolName === "unfollow_user" || toolName === "block_user" || toolName === "unblock_user") {
    const targetUserId = pickString(
      (normalized as any).targetUserId,
      (normalized as any).target_user_id,
      (normalized as any).userId,
      (normalized as any).user_id,
    );
    if (targetUserId) (normalized as any).targetUserId = targetUserId;
  }

  if (toolName === "conversation_mute") {
    const conversationId = pickString(
      (normalized as any).conversationId,
      (normalized as any).conversation_id,
    );
    if (conversationId) (normalized as any).conversationId = conversationId;
  }

  if (toolName === "message_send") {
    const conversationId = pickString(
      (normalized as any).conversationId,
      (normalized as any).conversation_id,
    );
    if (conversationId) (normalized as any).conversationId = conversationId;
    const targetUserId = pickString(
      (normalized as any).targetUserId,
      (normalized as any).target_user_id,
      (normalized as any).userId,
      (normalized as any).user_id,
    );
    if (targetUserId) (normalized as any).targetUserId = targetUserId;
  }

  return normalized;
}

export function extractListNameFromText(text: string): string {
  const t = String(text ?? "");
  const m1 = t.match(/\blist\s+(?:named\s+)?["“”']([^"“”']{1,120})["“”']/i);
  if (m1?.[1]) return normalizeListName(m1[1]);

  const m2 = t.match(/\bfrom\s+list\s+([^\n\r\.!?]{1,120})/i);
  if (m2?.[1]) return normalizeListName(m2[1]);

  const m3 = t.match(/\bto\s+list\s+([^\n\r\.!?]{1,120})/i);
  if (m3?.[1]) return normalizeListName(m3[1]);

  return "";
}

export function extractTitleIdFromText(text: string): string {
  const t = String(text ?? "");

  const m1 = t.match(/\btitleId\s*[:=]?\s*([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  if (m1?.[1]) return String(m1[1]).toLowerCase();

  const m2 = t.match(/\bitemId\s*[:=]?\s*([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  if (m2?.[1]) return String(m2[1]).toLowerCase();

  const m3 = t.match(/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  if (m3?.[1]) return String(m3[1]).toLowerCase();

  return "";
}

export function applyTextInferences(tool: string, args: UnknownRecord, text: string): UnknownRecord {
  const updated: UnknownRecord = { ...(args ?? {}) };
  const toolName = String(tool ?? "");
  const inferredListName = extractListNameFromText(text);
  const inferredTitleId = extractTitleIdFromText(text);

  if (toolName.startsWith("list_") || toolName === "list_set_visibility") {
    if (!coerceArgString((updated as any).listId) && !coerceArgString((updated as any).listName) && inferredListName) {
      (updated as any).listName = inferredListName;
    }
  }

  const needsTitleId = new Set([
    "list_add_item",
    "list_add_items",
    "list_remove_item",
    "diary_set_status",
    "rate_title",
    "review_upsert",
  ]);

  if (needsTitleId.has(toolName) && !coerceArgString((updated as any).titleId) && inferredTitleId) {
    (updated as any).titleId = inferredTitleId;
  }

  if (toolName === "list_remove_item") {
    if (!coerceArgString((updated as any).itemId) && !coerceArgString((updated as any).titleId) && inferredTitleId) {
      (updated as any).titleId = inferredTitleId;
    }
  }

  if (toolName === "list_add_items") {
    const hasItems = Array.isArray((updated as any).items) && (updated as any).items.length > 0;
    const hasTitleIds = Array.isArray((updated as any).titleIds) && (updated as any).titleIds.length > 0;
    if (!hasItems && !hasTitleIds && inferredTitleId) {
      (updated as any).titleIds = [inferredTitleId];
    }
  }

  return updated;
}
