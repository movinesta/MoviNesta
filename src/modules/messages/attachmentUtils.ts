export type AttachmentKind = "image" | "audio" | "document";

export const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "heic",
  "heif",
]);

export const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac", "webm"]);

export const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "txt",
  "rtf",
]);

export const getFileExtension = (value: string | null | undefined) => {
  if (!value) return null;
  const clean = value.split("?")[0]?.split("#")[0] ?? "";
  const last = clean.split("/").pop() ?? "";
  const ext = last.split(".").pop()?.toLowerCase() ?? "";
  return ext || null;
};

export const getAttachmentKindFromPath = (path: string): AttachmentKind => {
  const ext = getFileExtension(path);
  if (ext && IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext && AUDIO_EXTENSIONS.has(ext)) return "audio";
  return "document";
};

export const getAttachmentLabel = (kind: AttachmentKind) => {
  switch (kind) {
    case "audio":
      return "Audio";
    case "image":
      return "Photo";
    case "document":
    default:
      return "Document";
  }
};

export const getAttachmentNameFromPath = (path: string) => {
  if (!path) return "Attachment";
  const clean = path.split("?")[0]?.split("#")[0] ?? path;
  const base = clean.split("/").pop() ?? clean;
  return base || "Attachment";
};
