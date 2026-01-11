import { useCallback, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { CHAT_MEDIA_BUCKET } from "./chatMedia";
import { createClientId } from "./clientId";
import { prefetchSignedStorageUrl } from "./storageUrls";
import { removeChatMediaFile } from "./chatMediaStorage";
import { usePublicSettings } from "@/providers/PublicSettingsProvider";
import type { AttachmentKind } from "./attachmentUtils";
import {
  AUDIO_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  getFileExtension,
} from "./attachmentUtils";

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${Math.round(mb)}MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${Math.round(kb)}KB`;
  return `${bytes}B`;
}

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpg": "jpg",
  "image/jpeg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

const AUDIO_MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac",
};

const DOCUMENT_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/rtf": "rtf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

const ALLOWED_IMAGE_MIME_TYPES = new Set(Object.keys(IMAGE_MIME_TO_EXT));
const ALLOWED_AUDIO_MIME_TYPES = new Set(Object.keys(AUDIO_MIME_TO_EXT));
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(Object.keys(DOCUMENT_MIME_TO_EXT));

const getSafeImageExtension = (file: File) => {
  if (file.type && IMAGE_MIME_TO_EXT[file.type]) return IMAGE_MIME_TO_EXT[file.type];

  // Some environments omit the MIME type; fall back to filename extension, but keep a whitelist.
  const ext = getFileExtension(file.name);
  if (!ext) return null;
  if (ext === "jpeg") return "jpg";
  if (IMAGE_EXTENSIONS.has(ext)) return ext;
  return null;
};

const getSafeAudioExtension = (file: File) => {
  if (file.type && AUDIO_MIME_TO_EXT[file.type]) return AUDIO_MIME_TO_EXT[file.type];
  const ext = getFileExtension(file.name);
  if (!ext) return null;
  if (AUDIO_EXTENSIONS.has(ext)) return ext;
  return null;
};

const getSafeDocumentExtension = (file: File) => {
  if (file.type && DOCUMENT_MIME_TO_EXT[file.type]) return DOCUMENT_MIME_TO_EXT[file.type];
  const ext = getFileExtension(file.name);
  if (!ext) return null;
  if (DOCUMENT_EXTENSIONS.has(ext)) return ext;
  return null;
};

const validateAttachmentFile = (
  file: File,
  limits: { image: number; audio: number; document: number },
) => {
  const type = file.type ?? "";
  const isImage = type.startsWith("image/");
  const isAudio = type.startsWith("audio/");

  if (isImage) {
    if (file.type && !ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
      return {
        ok: false,
        error:
          "Unsupported image format. Please choose a JPG, PNG, WebP, GIF, HEIC/HEIF, or AVIF image.",
      } as const;
    }

    const ext = getSafeImageExtension(file);
    if (!ext) {
      return {
        ok: false,
        error:
          "Unsupported image format. Please choose a JPG, PNG, WebP, GIF, HEIC/HEIF, or AVIF image.",
      } as const;
    }

    if (file.size > limits.image) {
      return {
        ok: false,
        error: `That image is too large (max ${formatBytes(limits.image)}). Try a smaller file.`,
      } as const;
    }

    return { ok: true, kind: "image", ext } as const;
  }

  if (isAudio || ALLOWED_AUDIO_MIME_TYPES.has(type)) {
    const ext = getSafeAudioExtension(file);
    if (!ext) {
      return {
        ok: false,
        error: "Unsupported audio format. Please choose an MP3, WAV, OGG, M4A, AAC, or FLAC.",
      } as const;
    }

    if (file.size > limits.audio) {
      return {
        ok: false,
        error: `That audio file is too large (max ${formatBytes(limits.audio)}). Try a smaller file.`,
      } as const;
    }

    return { ok: true, kind: "audio", ext } as const;
  }

  const nameExtension = getFileExtension(file.name);
  if (
    ALLOWED_DOCUMENT_MIME_TYPES.has(type) ||
    (nameExtension && DOCUMENT_EXTENSIONS.has(nameExtension))
  ) {
    const ext = getSafeDocumentExtension(file);
    if (!ext) {
      return {
        ok: false,
        error:
          "Unsupported document format. Please choose a PDF, Word, Excel, PowerPoint, text, or CSV file.",
      } as const;
    }

    if (file.size > limits.document) {
      return {
        ok: false,
        error: `That document is too large (max ${formatBytes(
          limits.document,
        )}). Try a smaller file.`,
      } as const;
    }

    return { ok: true, kind: "document", ext } as const;
  }

  return {
    ok: false,
    error: "Unsupported file type. Please choose an image, audio, or document file.",
  } as const;
};

const buildAttachmentPath = (conversationId: string, userId: string, ext: string) => {
  const randomId = createClientId(() => String(Date.now()));
  return `message_attachments/${conversationId}/${userId}/${Date.now()}-${randomId}.${ext}`;
};

type AttemptSendPayload = {
  text: string;
  attachmentPath: string | null;
  attachmentKind?: AttachmentKind | null;
  clientId?: string;
};

export type PendingAttachment = {
  id: string;
  name: string;
  sizeLabel: string;
  kind: AttachmentKind;
  previewUrl?: string | null;
};

export function useAttachmentUpload(args: {
  conversationId: string | null;
  userId: string | null;
  isBlocked: boolean;
  blockedYou: boolean;
  attemptSend: (payload: AttemptSendPayload, opts?: { tempId?: string }) => void;
}) {
  const { conversationId, userId, isBlocked, blockedYou, attemptSend } = args;

  const { getNumber } = usePublicSettings();
  const maxImageBytes = Math.max(
    1,
    Math.floor(getNumber("ux.attachments.max_image_bytes", 10 * 1024 * 1024)),
  );
  const maxAudioBytes = Math.max(
    1,
    Math.floor(getNumber("ux.attachments.max_audio_bytes", 20 * 1024 * 1024)),
  );
  const maxDocumentBytes = Math.max(
    1,
    Math.floor(getNumber("ux.attachments.max_document_bytes", 15 * 1024 * 1024)),
  );

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);

  // Best-effort cancellation token for uploads (Supabase upload itself is not abortable).
  const uploadTokenRef = useRef(0);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const clearUploadError = useCallback(() => setUploadError(null), []);

  const setPendingAttachmentState = useCallback((next: PendingAttachment | null) => {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return next;
    });
  }, []);

  const clearPendingAttachment = useCallback(() => {
    setPendingAttachmentState(null);
  }, [setPendingAttachmentState]);

  const cancelAttachmentUpload = useCallback(() => {
    uploadTokenRef.current += 1;
    setIsUploadingAttachment(false);
    clearPendingAttachment();
  }, [clearPendingAttachment]);

  const openImagePicker = useCallback(() => {
    if (!conversationId || !userId) return;
    if (isBlocked || blockedYou) return;

    imageInputRef.current?.click();
  }, [blockedYou, conversationId, isBlocked, userId]);

  const openAttachmentPicker = useCallback(() => {
    if (!conversationId || !userId) return;
    if (isBlocked || blockedYou) return;

    attachmentInputRef.current?.click();
  }, [blockedYou, conversationId, isBlocked, userId]);

  const sendAttachmentFile = useCallback(
    async (file: File) => {
      if (!conversationId || !userId) return;
      if (isBlocked || blockedYou) return;

      setUploadError(null);
      const validation = validateAttachmentFile(file, {
        image: maxImageBytes,
        audio: maxAudioBytes,
        document: maxDocumentBytes,
      });
      if (!validation.ok) {
        setUploadError(validation.error);
        return;
      }
      // Create a best-effort cancel token. If the user cancels, we stop updating UI and skip sending.
      const token = (uploadTokenRef.current += 1);
      setIsUploadingAttachment(true);

      const previewUrl =
        validation.kind === "image" || validation.kind === "audio"
          ? URL.createObjectURL(file)
          : null;
      setPendingAttachmentState({
        id: createClientId(),
        name: file.name,
        sizeLabel: formatBytes(file.size),
        kind: validation.kind,
        previewUrl,
      });

      const path = buildAttachmentPath(conversationId, userId, validation.ext);
      let didSend = false;

      try {
        const { error: uploadErrorResult } = await supabase.storage
          .from(CHAT_MEDIA_BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        // If the user cancelled while we were uploading, clean up the uploaded file if it exists.
        if (token !== uploadTokenRef.current) {
          try {
            await removeChatMediaFile(path);
          } catch {
            // ignore
          }
          return;
        }

        if (uploadErrorResult) {
          console.error("[useAttachmentUpload] image upload error", uploadErrorResult);
          setUploadError("Upload failed. Please try another image.");
          return;
        }

        // Prefetch a signed URL for snappier first render, but don't block sending on signing failures.
        void prefetchSignedStorageUrl(CHAT_MEDIA_BUCKET, path);

        // One more cancellation check before we attempt the DB insert.
        if (token !== uploadTokenRef.current) {
          try {
            await removeChatMediaFile(path);
          } catch {
            // ignore
          }
          return;
        }

        attemptSend({ text: "", attachmentPath: path, attachmentKind: validation.kind });
        didSend = true;
      } catch (error) {
        console.error("[useAttachmentUpload] sendAttachmentFile failed", error);
        setUploadError("Something went wrong while sending your attachment.");

        // If the upload succeeded but the send failed before it hit the DB, the file can be retried
        // (and can be manually discarded via the failed message UI).
      } finally {
        // Don't clobber a newer upload.
        if (token === uploadTokenRef.current) {
          setIsUploadingAttachment(false);
          if (didSend) {
            clearPendingAttachment();
          }
        }
      }
    },
    [
      attemptSend,
      blockedYou,
      clearPendingAttachment,
      conversationId,
      isBlocked,
      maxAudioBytes,
      maxDocumentBytes,
      maxImageBytes,
      userId,
    ],
  );

  const handleImageSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      event.target.value = "";

      if (!file || !conversationId || !userId) return;
      if (isUploadingAttachment) return;
      if (isBlocked || blockedYou) return;

      await sendAttachmentFile(file);
    },
    [blockedYou, conversationId, isBlocked, isUploadingAttachment, sendAttachmentFile, userId],
  );

  const handleAttachmentSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      event.target.value = "";

      if (!file || !conversationId || !userId) return;
      if (isUploadingAttachment) return;
      if (isBlocked || blockedYou) return;

      await sendAttachmentFile(file);
    },
    [blockedYou, conversationId, isBlocked, isUploadingAttachment, sendAttachmentFile, userId],
  );

  return {
    imageInputRef,
    attachmentInputRef,
    openImagePicker,
    openAttachmentPicker,
    handleImageSelected,
    handleAttachmentSelected,
    sendAttachmentFile,
    pendingAttachment,
    clearPendingAttachment,
    isUploadingAttachment,
    uploadError,
    clearUploadError,
    cancelAttachmentUpload,
  };
}
