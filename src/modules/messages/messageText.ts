/**
 * Message body helpers.
 *
 * This file is a compatibility layer for different message storage formats:
 * - Legacy: `body` stored as plain text
 * - Transitional: `body` stored as a JSON string
 * - New: `body` stored as JSON (jsonb), and/or separate columns (message_type/text/client_id/meta)
 *
 * Many UI modules import helpers from here, so keep exports stable.
 */

export interface MessageMeta extends Record<string, unknown> {
  deleted?: boolean;
  deletedAt?: string;
  editedAt?: string;
  caption?: string;
}

export type ParsedMessageBody = {
  type: string;
  text: string;
  clientId: string | null;
  meta: MessageMeta;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  return typeof v === "object" && v !== null && !Array.isArray(v);
};

const tryParseJsonObject = (raw: string): Record<string, unknown> | null => {
  const s = raw.trim();
  if (!s) return null;
  // Quick filter to avoid throwing on most normal texts.
  const first = s[0];
  if (first !== "{" && first !== "[") return null;
  try {
    const parsed = JSON.parse(s) as unknown;
    if (isPlainObject(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
};

const coerceString = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Normalize any supported message body variant into a consistent object.
 */
export function parseMessageBody(body: unknown): ParsedMessageBody {
  // Default
  let obj: Record<string, unknown> | null = null;
  let legacyText: string | null = null;

  if (typeof body === "string") {
    const parsed = tryParseJsonObject(body);
    if (parsed) obj = parsed;
    else legacyText = body;
  } else if (isPlainObject(body)) {
    obj = body;
  }

  const type =
    coerceString(obj?.message_type) ??
    coerceString(obj?.type) ??
    (legacyText != null ? "text" : "unknown");

  const text = coerceString(obj?.text) ?? (legacyText != null ? legacyText : "");

  const clientId = coerceString(obj?.clientId) ?? coerceString(obj?.client_id) ?? null;

  // Meta:
  // - If `meta` is present and is an object, start from it
  // - Otherwise, treat the whole object as meta (so flags like deleted/editedAt are accessible)
  const metaBase = isPlainObject(obj?.meta) ? (obj!.meta as Record<string, unknown>) : (obj ?? {});
  const meta: Record<string, unknown> = { ...metaBase };

  // Ensure top-level commonly-used flags always exist in meta if present
  for (const k of ["deleted", "deletedAt", "editedAt", "caption"]) {
    const v = obj?.[k];
    if (v !== undefined && meta[k] === undefined) meta[k] = v as unknown;
  }

  return {
    type,
    text: typeof text === "string" ? text : "",
    clientId,
    meta,
  };
}

/** Extract the message type ("text", "image", "text+image", "system", etc.). */
export function getMessageType(body: unknown): string {
  return parseMessageBody(body).type || "unknown";
}

/** Extract the message client id used for optimistic reconciliation. */
export function getMessageClientId(body: unknown): string | null {
  return parseMessageBody(body).clientId;
}

/** Extract meta payload (if any) from any supported body variant. */
export function getMessageMeta(body: unknown): MessageMeta {
  const parsed = parseMessageBody(body);
  return parsed.meta ?? {};
}

/**
 * Parse body to a user-facing text string.
 * - image messages default to "Photo" unless a caption is present
 * - deleted messages show "Message deleted"
 */
export function parseMessageText(body: unknown): string {
  const parsed = parseMessageBody(body);
  const meta = parsed.meta ?? {};
  const isDeleted = meta.deleted === true;

  if (isDeleted) return "Message deleted";

  const type = parsed.type;

  // For image messages, support caption in meta or top-level.
  const caption =
    typeof meta.caption === "string"
      ? meta.caption
      : typeof (meta as any).text === "string"
        ? (meta as any).text
        : null;

  if ((type === "image" || type === "text+image") && parsed.text.trim() === "") {
    const c = typeof caption === "string" ? caption.trim() : "";
    return c ? c : "Photo";
  }

  const t = typeof parsed.text === "string" ? parsed.text : "";
  return t.trim() ? t.trim() : "";
}

/**
 * Returns a stable inbox preview string for a message.
 * - deleted messages are prefixed with 🗑️
 * - image placeholder is prefixed with 📷
 */
export function getMessagePreview(body: unknown, maxLen = 120): string {
  const parsed = parseMessageBody(body);
  const meta = parsed.meta ?? {};
  const type = parsed.type;
  const isDeleted = meta.deleted === true;

  const text = parseMessageText(body);
  let preview = text;

  if (isDeleted) {
    preview = `🗑️ ${text}`;
  } else if (type === "image" && text === "Photo") {
    preview = `📷 Photo`;
  }

  if (typeof preview !== "string") preview = "";
  const clean = preview.trim();
  if (!clean) return "";

  if (maxLen > 0 && clean.length > maxLen) {
    return clean.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
  }
  return clean;
}

/**
 * Build the next `body` value for an edited message.
 * Keeps compatibility with legacy and JSON body formats:
 * - If current body is an object (jsonb), returns an object
 * - Otherwise returns a JSON string
 */
export function buildEditedMessageBody(currentBody: unknown, nextText: string): unknown {
  const trimmed = (typeof nextText === "string" ? nextText : "").trim();
  const now = new Date().toISOString();

  const parsed = parseMessageBody(currentBody);
  const baseObj: Record<string, unknown> = {};

  // Prefer to preserve an existing structured body if present
  if (isPlainObject(currentBody)) {
    Object.assign(baseObj, currentBody);
  } else if (typeof currentBody === "string") {
    const obj = tryParseJsonObject(currentBody);
    if (obj) Object.assign(baseObj, obj);
  }

  const type =
    coerceString(baseObj.message_type) ?? coerceString(baseObj.type) ?? parsed.type ?? "text";

  baseObj.type = type;

  // Preserve client id if present
  const existingClientId =
    coerceString(baseObj.clientId) ?? coerceString(baseObj.client_id) ?? parsed.clientId;
  if (existingClientId) baseObj.clientId = existingClientId;

  // For image messages, treat edited text as caption if original text is empty
  const originalText = coerceString(baseObj.text) ?? parsed.text ?? "";
  if ((type === "image" || type === "text+image") && originalText.trim() === "") {
    baseObj.caption = trimmed;
    // Keep text empty for image-only; UI reads caption.
    baseObj.text = "";
  } else {
    baseObj.text = trimmed;
  }

  baseObj.editedAt = now;

  // Ensure meta carries editedAt too (some UI reads it from meta)
  if (isPlainObject(baseObj.meta)) {
    baseObj.meta = { ...(baseObj.meta as Record<string, unknown>), editedAt: now };
  } else {
    // Keep meta lightweight but include flags
    baseObj.meta = { editedAt: now };
  }

  // If stored as jsonb, return object; otherwise return JSON string.
  if (isPlainObject(currentBody)) return baseObj;
  return JSON.stringify(baseObj);
}
