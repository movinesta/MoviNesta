export type MessageBodyType = "text" | "image" | "text+image" | "system" | "unknown";

export type ParsedMessageMeta = {
  editedAt?: string;
  deletedAt?: string;
  deleted?: boolean;
  clientId?: string;
};

export type ParsedMessageBody = ParsedMessageMeta & {
  raw: unknown;
  isJson: boolean;
  type: MessageBodyType;
  text?: string;
  caption?: string;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

/**
 * Parses the message body with a small, permissive schema.
 *
 * Notes:
 * - Some legacy rows may store plain strings or JSON strings.
 * - We keep parsing tolerant to avoid crashing the UI on malformed bodies.
 */
export const parseMessageBody = (body: string | null): ParsedMessageBody => {
  if (!body) return { raw: null, isJson: false, type: "unknown" };

  try {
    const parsed = JSON.parse(body);

    // JSON string (e.g., "hello")
    if (typeof parsed === "string") {
      const trimmed = parsed.trim();
      return {
        raw: parsed,
        isJson: true,
        type: "text",
        text: trimmed,
      };
    }

    const obj = asObject(parsed);
    if (!obj) {
      return { raw: parsed, isJson: true, type: "unknown" };
    }

    const typeRaw = typeof obj.type === "string" ? obj.type : undefined;
    let type: MessageBodyType =
      typeRaw === "text" || typeRaw === "image" || typeRaw === "text+image" || typeRaw === "system"
        ? typeRaw
        : "unknown";

    // Heuristic: if the body looks like a plain text payload but is missing a type, treat it as text.
    // This keeps legacy bodies compatible with newer UI affordances (reactions, edit, etc.).
    if (type === "unknown" && typeof obj.text === "string" && obj.text.trim()) {
      type = "text";
    }

    const deleted = obj.deleted === true;

    const editedAt = typeof obj.editedAt === "string" ? obj.editedAt : undefined;
    const deletedAt = typeof obj.deletedAt === "string" ? obj.deletedAt : undefined;
    const clientId = typeof obj.clientId === "string" ? obj.clientId : undefined;

    const text = typeof obj.text === "string" ? obj.text : undefined;
    const caption = typeof obj.caption === "string" ? obj.caption : undefined;

    return {
      raw: parsed,
      isJson: true,
      type,
      deleted,
      editedAt,
      deletedAt,
      clientId,
      text,
      caption,
    };
  } catch {
    // Not JSON – treat as plain text
    const trimmed = body.trim();
    return {
      raw: body,
      isJson: false,
      type: "text",
      text: trimmed,
    };
  }
};

export const getMessageMeta = (body: string | null): ParsedMessageMeta => {
  const parsed = parseMessageBody(body);
  return {
    editedAt: parsed.editedAt,
    deletedAt: parsed.deletedAt,
    deleted: parsed.deleted,
    clientId: parsed.clientId,
  };
};

export const getMessageType = (body: string | null): MessageBodyType => {
  return parseMessageBody(body).type;
};

export const parseMessageText = (body: string | null): string => {
  if (!body) return "";

  const parsed = parseMessageBody(body);

  // Deleted messages should always render a placeholder.
  if (parsed.deleted) {
    return "Message deleted";
  }

  // Image messages: prefer caption, fall back to text, otherwise stable placeholder.
  if (parsed.type === "image") {
    const caption = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    return caption || text || "Photo";
  }

  // Simple text payload: { text: "Hello" }
  if (typeof parsed.text === "string") {
    const t = parsed.text.trim();
    if (t) return t;
  }

  // If body is valid JSON but doesn't match our small schema, attempt legacy fallbacks.
  if (parsed.isJson) {
    const obj = asObject(parsed.raw);
    if (obj) {
      // Rich-editor blocks: { blocks: [{ text: "Hello" }, ...] }
      const blocks = obj.blocks;
      if (Array.isArray(blocks)) {
        const texts = blocks
          .map((block: unknown) => {
            const b = asObject(block);
            return typeof b?.text === "string" ? b.text.trim() : "";
          })
          .filter(Boolean);

        if (texts.length > 0) {
          return texts.join("\n");
        }
      }

      // Generic "message" field
      if (typeof obj.message === "string") {
        return obj.message as string;
      }
    }

    // JSON string case already handled in parseMessageBody().
  }

  // Fallback to original string
  return body;
};

/**
 * Extracts the client-generated identifier used to reconcile optimistic messages
 * with server-confirmed inserts.
 */
export const getMessageClientId = (body: string | null): string | null => {
  const meta = getMessageMeta(body);
  return meta.clientId ?? null;
};

const normalizeForPreview = (value: string): string => {
  // Collapse whitespace and line breaks
  const singleLine = value.replace(/\s+/g, " ").replace(/\u200B/g, "").trim();

  return singleLine;
};

export const getMessagePreview = (body: string | null, maxLength = 80): string | null => {
  if (!body) return null;

  // If this is a deleted message, always show a preview (so inbox rows don't look empty).
  const meta = getMessageMeta(body);
  if (meta.deleted) {
    return "🗑️ Message deleted";
  }

  const full = parseMessageText(body);
  const normalized = normalizeForPreview(full);

  if (!normalized) return null;

  let preview = normalized;

  // If this looks like a bare "Photo" placeholder, make it a bit friendlier.
  if (preview.toLowerCase() === "photo") {
    preview = "📷 Photo";
  }

  if (preview.length <= maxLength) return preview;
  return `${preview.slice(0, maxLength - 1).trimEnd()}…`;
};

/**
 * Builds an edited message body while preserving existing metadata.
 *
 * - Only supports editing plain-text messages (no attachments, not deleted).
 * - Preserves fields like clientId.
 */
export const buildEditedMessageBody = (currentBody: string | null, newText: string): string => {
  const trimmed = newText.trim();
  if (!trimmed) {
    throw new Error("Cannot save an empty message.");
  }

  const parsed = parseMessageBody(currentBody);
  const base = asObject(parsed.raw);

  if (base) {
    if (base.deleted === true) {
      throw new Error("Cannot edit a deleted message.");
    }
    const type = typeof base.type === "string" ? base.type : undefined;
    if (type && type !== "text") {
      throw new Error("Only plain text messages can be edited.");
    }

    return JSON.stringify({
      ...base,
      type: "text",
      text: trimmed,
      editedAt: new Date().toISOString(),
    });
  }

  // Non-JSON / legacy string bodies become canonical text payloads.
  return JSON.stringify({
    type: "text",
    text: trimmed,
    editedAt: new Date().toISOString(),
  });
};
