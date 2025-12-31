import { useCallback, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { CHAT_MEDIA_BUCKET } from "./chatMedia";
import { createClientId } from "./clientId";
import { prefetchSignedStorageUrl } from "./storageUrls";
import { removeChatMediaFile } from "./chatMediaStorage";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

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

const ALLOWED_IMAGE_MIME_TYPES = new Set(Object.keys(IMAGE_MIME_TO_EXT));

const getSafeImageExtension = (file: File) => {
  if (file.type && IMAGE_MIME_TO_EXT[file.type]) return IMAGE_MIME_TO_EXT[file.type];

  // Some environments omit the MIME type; fall back to filename extension, but keep a whitelist.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? null;
  if (!ext) return null;
  if (ext === "jpeg") return "jpg";
  if (["jpg", "png", "webp", "gif", "avif", "heic", "heif"].includes(ext)) return ext;
  return null;
};

const validateImageFile = (file: File) => {
  if (file.type) {
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "Please choose an image file." } as const;
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
      return {
        ok: false,
        error:
          "Unsupported image format. Please choose a JPG, PNG, WebP, GIF, HEIC/HEIF, or AVIF image.",
      } as const;
    }
  } else {
    const ext = getSafeImageExtension(file);
    if (!ext) {
      return {
        ok: false,
        error:
          "Unsupported image format. Please choose a JPG, PNG, WebP, GIF, HEIC/HEIF, or AVIF image.",
      } as const;
    }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "That image is too large (max 10MB). Try a smaller file." } as const;
  }

  return { ok: true } as const;
};

const buildAttachmentPath = (conversationId: string, userId: string, ext: string) => {
  const randomId = createClientId(() => String(Date.now()));
  return `message_attachments/${conversationId}/${userId}/${Date.now()}-${randomId}.${ext}`;
};

type AttemptSendPayload = {
  text: string;
  attachmentPath: string | null;
  clientId?: string;
};

export function useAttachmentUpload(args: {
  conversationId: string | null;
  userId: string | null;
  isBlocked: boolean;
  blockedYou: boolean;
  attemptSend: (payload: AttemptSendPayload, opts?: { tempId?: string }) => void;
}) {
  const { conversationId, userId, isBlocked, blockedYou, attemptSend } = args;

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Best-effort cancellation token for uploads (Supabase upload itself is not abortable).
  const uploadTokenRef = useRef(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearUploadError = useCallback(() => setUploadError(null), []);

  const cancelImageUpload = useCallback(() => {
    uploadTokenRef.current += 1;
    setIsUploadingImage(false);
  }, []);

  const openFilePicker = useCallback(() => {
    if (!conversationId || !userId) return;
    if (isBlocked || blockedYou) return;

    fileInputRef.current?.click();
  }, [blockedYou, conversationId, isBlocked, userId]);

  const sendImageFile = useCallback(
    async (file: File) => {
      if (!conversationId || !userId) return;
      if (isBlocked || blockedYou) return;

      setUploadError(null);
      const validation = validateImageFile(file);
      if (!validation.ok) {
        setUploadError(validation.error);
        return;
      }
      // Create a best-effort cancel token. If the user cancels, we stop updating UI and skip sending.
      const token = (uploadTokenRef.current += 1);
      setIsUploadingImage(true);

      const ext = getSafeImageExtension(file);
      if (!ext) {
        setUploadError("Unsupported image format.");
        setIsUploadingImage(false);
        return;
      }

      const path = buildAttachmentPath(conversationId, userId, ext);

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

        attemptSend({ text: "", attachmentPath: path });
      } catch (error) {
        console.error("[useAttachmentUpload] sendImageFile failed", error);
        setUploadError("Something went wrong while sending your image.");

        // If the upload succeeded but the send failed before it hit the DB, the file can be retried
        // (and can be manually discarded via the failed message UI).
      } finally {
        // Don't clobber a newer upload.
        if (token === uploadTokenRef.current) {
          setIsUploadingImage(false);
        }
      }
    },
    [attemptSend, blockedYou, conversationId, isBlocked, userId],
  );

  const handleImageSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      event.target.value = "";

      if (!file || !conversationId || !userId) return;
      if (isUploadingImage) return;
      if (isBlocked || blockedYou) return;

      await sendImageFile(file);
    },
    [blockedYou, conversationId, isBlocked, isUploadingImage, sendImageFile, userId],
  );

  return {
    fileInputRef,
    openFilePicker,
    handleImageSelected,
    sendImageFile,
    isUploadingImage,
    uploadError,
    clearUploadError,
    cancelImageUpload,
  };
}
