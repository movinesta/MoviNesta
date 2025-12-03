export const parseMessageText = (body: string | null): string => {
  if (!body) return "";

  try {
    const parsed = JSON.parse(body);

    if (!parsed || typeof parsed !== "object") {
      if (typeof parsed === "string") return parsed;
      return body;
    }

    // Simple text payload: { text: "Hello" }
    if (typeof (parsed as any).text === "string") {
      return (parsed as any).text as string;
    }

    // Rich-editor blocks: { blocks: [{ text: "Hello" }, ...] }
    const blocks = (parsed as any).blocks;
    if (Array.isArray(blocks)) {
      const texts = blocks
        .map((block: any) => (typeof block?.text === "string" ? (block.text as string).trim() : ""))
        .filter(Boolean);

      if (texts.length > 0) {
        return texts.join("\n");
      }
    }

    // Image-only messages
    if ((parsed as any).type === "image") {
      if (typeof (parsed as any).caption === "string" && (parsed as any).caption.trim()) {
        return (parsed as any).caption as string;
      }
      return "Photo";
    }

    // Generic "message" field
    if (typeof (parsed as any).message === "string") {
      return (parsed as any).message as string;
    }

    // Fallback to original string
    return body;
  } catch {
    // Not JSON – treat as plain text
    return body;
  }
};

export type ParsedMessageMeta = {
  editedAt?: string;
  deletedAt?: string;
  deleted?: boolean;
};

export const getMessageMeta = (body: string | null): ParsedMessageMeta => {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      return {
        editedAt: typeof (parsed as any).editedAt === "string" ? (parsed as any).editedAt : undefined,
        deletedAt: typeof (parsed as any).deletedAt === "string" ? (parsed as any).deletedAt : undefined,
        deleted: (parsed as any).deleted === true,
      };
    }
  } catch {
    // ignore parse errors and return empty meta
  }
  return {};
};

const normalizeForPreview = (value: string): string => {
  // Collapse whitespace and line breaks
  const singleLine = value
    .replace(/\s+/g, " ")
    .replace(/\u200B/g, "")
    .trim();

  return singleLine;
};

export const getMessagePreview = (body: string | null, maxLength = 80): string | null => {
  if (!body) return null;

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
