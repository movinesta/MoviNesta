import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  FileText,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Send,
  Smile,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageComposer } from "./MessageComposer";
import { usePublicSettings } from "@/providers/PublicSettingsProvider";
import type { PendingAttachment } from "../useAttachmentUpload";

type Props = {
  show: boolean;
  headerHeight: number;
  onHeightChange: (height: number) => void;

  typingUsers: Array<{ userId: string; displayName: string }>;
  isGroupConversation: boolean;

  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;

  noteLocalInputActivity: (isTyping: boolean) => void;
  stopTyping: () => void;
  onSendText: (text: string) => void;
  onRequestScrollToBottom?: () => void;

  isUploadingAttachment: boolean;
  pendingAttachment: PendingAttachment | null;
  clearPendingAttachment: () => void;
  cancelAttachmentUpload: () => void;

  sendError: boolean;
  sendErrorMessage?: string | null;
  canRetrySend: boolean;
  onRetrySend: () => void;

  uploadError: string | null;
  clearUploadError: () => void;

  showEmojiPicker: boolean;
  setShowEmojiPicker: (open: boolean) => void;

  openCameraPicker: () => void;
  onImageSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  openAttachmentPicker: () => void;
  imageInputRef: React.RefObject<HTMLInputElement>;
  attachmentInputRef: React.RefObject<HTMLInputElement>;
  onAttachmentSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachmentFile?: (file: File) => void;
  disableSend: boolean;
};

const EMOJI_SET = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😅",
  "😆",
  "😉",
  "😊",
  "😎",
  "😍",
  "🥰",
  "😘",
  "🤩",
  "🥹",
  "🙂",
  "🙃",
  "🤔",
  "🤨",
  "😏",
  "😒",
  "😭",
  "😢",
  "😡",
  "🤯",
  "🥳",
  "👍",
  "👎",
  "🙌",
  "👏",
  "🙏",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🩵",
  "🪄",
  "✨",
  "🔥",
  "⭐",
  "🌙",
  "🎬",
  "🍿",
  "🎉",
  "💯",
] as const;

// "Recent files" is local-only metadata (no file contents stored).
// Browsers generally won't allow re-attaching a previous local file without a new user gesture;
// this section is for fast navigation and a familiar Telegram-like affordance.
type RecentFile = {
  id: string;
  name: string;
  size: number;
  sizeLabel: string;
  badge: string;
  mime: string;
  kind: "image" | "audio" | "file";
  lastUsed: number; // epoch ms
};

type RecentFileUI = RecentFile & { previewUrl?: string };

const RECENTS_STORAGE_KEY = "movinesta_recent_files_v1";
const MAX_RECENTS = 6;

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const precision = idx == 0 ? 0 : idx == 1 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[idx]}`;
};

const getBadge = (fileName: string, mime: string) => {
  const ext = (fileName.split(".").pop() ?? "").toUpperCase();
  if (ext) return ext;
  if (mime?.startsWith("image/")) return "IMG";
  if (mime?.startsWith("audio/")) return "AUDIO";
  return "FILE";
};

const getKind = (mime: string): RecentFile["kind"] => {
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("audio/")) return "audio";
  return "file";
};

const safeLoadRecents = (): RecentFile[] => {
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object")
      .map((x: any) => ({
        id: String(x?.id ?? ""),
        name: String(x?.name ?? "File"),
        size: Number(x?.size ?? 0),
        sizeLabel: String(x?.sizeLabel ?? "0 B"),
        badge: String(x?.badge ?? "FILE"),
        mime: String(x?.mime ?? ""),
        kind: ["image", "audio", "file"].includes(x?.kind) ? x.kind : "file",
        lastUsed: Number(x?.lastUsed ?? 0),
      }))
      .filter((x) => x.id && x.name)
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
};

const safeSaveRecents = (items: RecentFileUI[]) => {
  try {
    const serializable = items.map((item) => {
      const { previewUrl, ...rest } = item;
      void previewUrl;
      return rest;
    });
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(serializable.slice(0, MAX_RECENTS)));
  } catch {
    // ignore
  }
};

export const ConversationComposerBar: React.FC<Props> = ({
  show,
  headerHeight,
  onHeightChange,
  draft,
  setDraft,
  textareaRef,
  noteLocalInputActivity,
  stopTyping,
  onSendText,
  onRequestScrollToBottom,
  isUploadingAttachment,
  pendingAttachment,
  clearPendingAttachment,
  cancelAttachmentUpload,
  sendError,
  sendErrorMessage,

  canRetrySend,
  onRetrySend,
  uploadError,
  clearUploadError,
  showEmojiPicker,
  setShowEmojiPicker,
  openCameraPicker,
  onImageSelected,
  openAttachmentPicker,
  imageInputRef,
  attachmentInputRef,
  onAttachmentSelected,
  onAttachmentFile,
  disableSend,
}) => {
  const { getNumber } = usePublicSettings();
  const maxMessageChars = Math.max(1, Math.floor(getNumber("ux.messages.max_message_chars", 2000)));
  const maxComposerHeightPx = Math.max(
    60,
    Math.floor(getNumber("ux.messages.composer_max_height_px", 140)),
  );

  // Telegram-style attachment menu: compact icon row + optional secondary sheet.
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  // Hybrid recent files layout: horizontal strip by default; "See all" expands to a vertical list.
  const [showAllRecents, setShowAllRecents] = useState(false);

  const [recents, setRecents] = useState<RecentFileUI[]>([]);
  const recentObjectUrlsRef = useRef<Set<string>>(new Set());

  // Horizontal recents strip: scroll cues + indicator
  const recentStripRef = useRef<HTMLDivElement | null>(null);
  const [recentStripUI, setRecentStripUI] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    pages: 1,
    active: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRecents(safeLoadRecents());
  }, []);

  useEffect(() => {
    return () => {
      for (const url of recentObjectUrlsRef.current) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      recentObjectUrlsRef.current.clear();
    };
  }, []);

  const recordRecentFile = useCallback((file: File) => {
    if (!file) return;

    const mime = file.type ?? "";
    const kind = getKind(mime);
    const badge = getBadge(file.name, mime);

    // Preview URLs are session-only; metadata is persisted.
    const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;
    if (previewUrl) recentObjectUrlsRef.current.add(previewUrl);

    const id = `${file.name}:${file.size}:${file.lastModified}:${mime}`;
    const nextItem: RecentFileUI = {
      id,
      name: file.name,
      size: file.size,
      sizeLabel: formatBytes(file.size),
      badge,
      mime,
      kind,
      lastUsed: Date.now(),
      previewUrl,
    };

    setRecents((prev) => {
      const without = prev.filter((x) => x.id !== id);
      const next = [nextItem, ...without].slice(0, MAX_RECENTS);

      // Revoke preview URLs for items that fell out of the list.
      const nextIdSet = new Set(next.map((x) => x.id));
      for (const item of prev) {
        if (item.previewUrl && !nextIdSet.has(item.id)) {
          try {
            URL.revokeObjectURL(item.previewUrl);
          } catch {
            // ignore
          }
          recentObjectUrlsRef.current.delete(item.previewUrl);
        }
      }

      safeSaveRecents(next);
      return next;
    });
  }, []);

  const updateRecentStripUI = useCallback(() => {
    const el = recentStripRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const left = el.scrollLeft;
    const canScrollLeft = left > 1;
    const canScrollRight = left < max - 1;

    const rawPages = max > 0 ? Math.ceil(el.scrollWidth / Math.max(1, el.clientWidth)) : 1;
    const pages = Math.min(5, Math.max(1, rawPages));
    const progress = max > 0 ? left / max : 0;
    const active = pages > 1 ? Math.round(progress * (pages - 1)) : 0;

    setRecentStripUI({ canScrollLeft, canScrollRight, pages, active });
  }, []);

  useEffect(() => {
    if (!showAttachmentSheet || showAllRecents) return;
    const el = recentStripRef.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updateRecentStripUI();
      });
    };

    updateRecentStripUI();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateRecentStripUI);

    return () => {
      el.removeEventListener("scroll", onScroll as any);
      window.removeEventListener("resize", updateRecentStripUI);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [recents.length, showAllRecents, showAttachmentSheet, updateRecentStripUI]);

  const handleDraftChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextRaw = event.target.value;
      const next = nextRaw.length > maxMessageChars ? nextRaw.slice(0, maxMessageChars) : nextRaw;
      setDraft(next);
      if (showEmojiPicker) setShowEmojiPicker(false);
      noteLocalInputActivity(next.trim().length > 0);

      // Auto-size within a safe cap.
      const el = event.target;
      el.style.height = "auto";
      const nextHeight = Math.min(el.scrollHeight, maxComposerHeightPx);
      el.style.height = `${nextHeight}px`;
    },
    [
      maxComposerHeightPx,
      maxMessageChars,
      noteLocalInputActivity,
      setDraft,
      setShowEmojiPicker,
      showEmojiPicker,
    ],
  );

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (!emoji) return;
      setDraft((prev) => {
        const next = `${prev}${emoji}`;
        noteLocalInputActivity(next.trim().length > 0);
        return next;
      });

      // Resize after the state update.
      queueMicrotask(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, maxComposerHeightPx)}px`;
      });
    },
    [maxComposerHeightPx, noteLocalInputActivity, setDraft, textareaRef],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      // Do not block sending while a previous send is still in-flight.
      // Users should be able to send multiple messages quickly (Instagram-like).
      if (disableSend || isUploadingAttachment) return;
      const text = draft.trim();
      if (!text) return;

      setDraft("");
      stopTyping();
      onSendText(text);
    },
    [disableSend, draft, isUploadingAttachment, onSendText, setDraft, stopTyping],
  );

  const sendButtonDisabled = disableSend || !draft.trim() || isUploadingAttachment;

  const handleImageSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) recordRecentFile(file);
      onImageSelected(event);
    },
    [onImageSelected, recordRecentFile],
  );

  const handleAttachmentSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) recordRecentFile(file);
      onAttachmentSelected(event);
    },
    [onAttachmentSelected, recordRecentFile],
  );
  const cameraDisabled = isUploadingAttachment || disableSend;
  const attachDisabled = isUploadingAttachment || disableSend;

  const attachmentMenuItems = useMemo(
    () =>
      [
        {
          key: "photo",
          label: "Photo",
          icon: <Camera className="h-4 w-4" aria-hidden="true" />,
          onClick: () => {
            setShowAttachmentMenu(false);
            setShowAttachmentSheet(false);
            openCameraPicker();
          },
          disabled: cameraDisabled,
        },
        {
          key: "file",
          label: "File",
          icon: <FileText className="h-4 w-4" aria-hidden="true" />,
          onClick: () => {
            setShowAttachmentMenu(false);
            setShowAttachmentSheet(false);
            openAttachmentPicker();
          },
          disabled: attachDisabled,
        },
        {
          key: "more",
          label: "More",
          icon: <MoreHorizontal className="h-4 w-4" aria-hidden="true" />,
          onClick: () => {
            setShowAttachmentMenu(false);
            setShowAttachmentSheet(true);
          },
          disabled: attachDisabled,
        },
      ] as const,
    [attachDisabled, cameraDisabled, openAttachmentPicker, openCameraPicker],
  );

  const attachmentStatusLabel = (() => {
    if (!pendingAttachment) return null;
    if (isUploadingAttachment) return "Uploading…";
    if (uploadError) return "Upload failed";
    return "Ready";
  })();

  if (!show) return null;

  return (
    <MessageComposer
      onSubmit={handleSubmit}
      className="space-y-2"
      onHeightChange={onHeightChange}
      minHeight={headerHeight}
      onDragOver={(event) => {
        if (!onAttachmentFile || disableSend) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        (event.currentTarget as any).dataset.dragging = "true";
      }}
      onDragLeave={(event) => {
        (event.currentTarget as any).dataset.dragging = "false";
      }}
      onDrop={(event) => {
        if (!onAttachmentFile || disableSend || isUploadingAttachment) return;
        event.preventDefault();
        (event.currentTarget as any).dataset.dragging = "false";
        const files = event.dataTransfer.files;
        if (!files || files.length === 0) return;
        const file = Array.from(files)[0];
        if (!file) return;
        recordRecentFile(file);
        onAttachmentFile(file);
      }}
    >
      {/* Typing indicator is now rendered Instagram-style in the message list footer. */}

      {pendingAttachment && (
        <div
          role="status"
          className="soft-row-card flex items-start justify-between gap-3 px-3 py-3 text-xs"
        >
          <div className="flex min-w-0 items-start gap-3">
            {pendingAttachment.kind === "image" && pendingAttachment.previewUrl ? (
              <img
                src={pendingAttachment.previewUrl}
                alt=""
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : pendingAttachment.kind === "audio" && pendingAttachment.previewUrl ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/60">
                <Volume2 className="h-5 w-5" aria-hidden="true" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/60">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
            )}

            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 truncate text-[13px] font-semibold text-foreground">
                  {pendingAttachment.name}
                </p>
                {attachmentStatusLabel ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {attachmentStatusLabel}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">{pendingAttachment.sizeLabel}</p>
              {pendingAttachment.kind === "audio" && pendingAttachment.previewUrl ? (
                <audio controls src={pendingAttachment.previewUrl} className="mt-2 w-52">
                  <track kind="captions" srcLang="en" label="Captions" />
                </audio>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="icon-hit"
            onClick={isUploadingAttachment ? cancelAttachmentUpload : clearPendingAttachment}
            aria-label={isUploadingAttachment ? "Cancel upload" : "Remove attachment"}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {isUploadingAttachment && (
        <div
          role="status"
          className="soft-row-card flex items-center justify-between gap-3 px-3 py-3 text-xs"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <div className="flex flex-col">
              <p className="font-semibold text-foreground">Uploading attachment…</p>
              <div
                className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-muted/70"
                aria-hidden="true"
              >
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/60" />
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="icon-hit"
            onClick={cancelAttachmentUpload}
            aria-label="Cancel upload"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {sendError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <p className="font-semibold text-foreground">
              {sendErrorMessage ?? "Couldn't send. Please try again."}
            </p>
          </div>
          {canRetrySend && (
            <Button type="button" size="sm" variant="outline" onClick={onRetrySend}>
              Retry
            </Button>
          )}
        </div>
      )}

      {uploadError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <p className="font-semibold text-foreground">{uploadError}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={clearUploadError}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex w-full items-center gap-2">
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Add emoji"
              className="icon-hit bg-muted/60 shadow-sm"
            >
              <Smile className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur"
          >
            <ScrollArea className="max-h-64">
              <div className="grid grid-cols-9 gap-2">
                {EMOJI_SET.map((emoji) => (
                  <Button
                    key={emoji}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="icon-hit rounded-xl text-lg"
                    onClick={() => {
                      handleEmojiSelect(emoji);
                      setShowEmojiPicker(false);
                    }}
                  >
                    <span>{emoji}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="icon-hit bg-muted/60 shadow-sm"
          onClick={openCameraPicker}
          aria-label="Send photo"
          disabled={cameraDisabled}
          aria-busy={isUploadingAttachment}
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
        </Button>
        <input
          type="file"
          ref={imageInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageSelected}
        />
        <Popover open={showAttachmentMenu} onOpenChange={setShowAttachmentMenu}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="icon-hit bg-muted/60 shadow-sm"
              aria-label="Add attachment"
              disabled={attachDisabled}
              aria-busy={isUploadingAttachment}
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="soft-popover w-auto p-2">
            <div className="flex items-center gap-2">
              {attachmentMenuItems.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 flex-col gap-1 rounded-2xl text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  aria-label={item.label}
                >
                  {item.icon}
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Dialog
          open={showAttachmentSheet}
          onOpenChange={(open) => {
            setShowAttachmentSheet(open);
            if (!open) setShowAllRecents(false);
          }}
        >
          <DialogContent className="fixed left-1/2 bottom-4 top-auto -translate-x-1/2 translate-y-0 w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-border/70 bg-card p-4 shadow-2xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted/70" aria-hidden="true" />
            <DialogHeader className="flex-row items-center justify-between space-y-0">
              <DialogTitle className="text-base">Attach</DialogTitle>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="icon-hit"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DialogClose>
            </DialogHeader>

            <div className="mt-3 grid gap-2">
              <button
                type="button"
                className="soft-row-card soft-row-card-interactive row-pad flex items-center justify-between"
                onClick={() => {
                  setShowAttachmentSheet(false);
                  openCameraPicker();
                }}
                disabled={cameraDisabled as any}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/60 text-foreground">
                    <Camera className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold">Photo</span>
                    <span className="text-xs text-muted-foreground">Choose an image</span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                className="soft-row-card soft-row-card-interactive row-pad flex items-center justify-between"
                onClick={() => {
                  setShowAttachmentSheet(false);
                  openAttachmentPicker();
                }}
                disabled={attachDisabled as any}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/60 text-foreground">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold">File</span>
                    <span className="text-xs text-muted-foreground">PDF, docs, audio, more</span>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Recent files</p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setShowAllRecents((v) => !v)}
                    aria-pressed={showAllRecents}
                  >
                    {showAllRecents ? "Hide" : "See all"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      setShowAttachmentSheet(false);
                      openAttachmentPicker();
                    }}
                    disabled={attachDisabled}
                  >
                    Browse
                  </Button>
                </div>
              </div>

              {/* Hybrid layout: horizontal strip by default; expanded list when "See all" is enabled. */}
              {!showAllRecents ? (
                <div className="relative mt-2">
                  <div
                    ref={recentStripRef}
                    className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                    role="list"
                    aria-label="Recent files"
                  >
                    {recents.length === 0 ? (
                      <div className="soft-row-card flex w-[260px] shrink-0 items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-foreground">
                            No recent files yet
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Attach something to see it here.
                          </p>
                        </div>
                      </div>
                    ) : (
                      recents.map((item) => (
                        <div key={item.id} role="listitem">
                          <button
                            type="button"
                            className="soft-row-card soft-row-card-interactive flex w-[220px] shrink-0 items-center gap-3 px-3 py-2 text-left disabled:pointer-events-none disabled:opacity-50"
                            onClick={() => {
                              setShowAttachmentSheet(false);
                              if (item.kind === "image") openCameraPicker();
                              else openAttachmentPicker();
                            }}
                            disabled={attachDisabled as any}
                            aria-label={`Attach ${item.name}`}
                            title={item.name}
                          >
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted/60 text-foreground">
                              {item.kind === "image" && item.previewUrl ? (
                                <img
                                  src={item.previewUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : item.kind === "audio" ? (
                                <Volume2 className="h-5 w-5" aria-hidden="true" />
                              ) : (
                                <FileText className="h-5 w-5" aria-hidden="true" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 truncate text-[13px] font-semibold">
                                  {item.name}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {item.badge}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {item.sizeLabel}
                                </span>
                              </div>
                            </div>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Scroll cue fades (stronger than dots alone) */}
                  {recentStripUI.canScrollLeft ? (
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent"
                      aria-hidden="true"
                    />
                  ) : null}
                  {recentStripUI.canScrollRight ? (
                    <div
                      className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent"
                      aria-hidden="true"
                    />
                  ) : null}

                  {/* Animated position indicator (kept subtle) */}
                  {recentStripUI.pages > 1 ? (
                    <div className="mt-2 flex items-center justify-center gap-1" aria-hidden="true">
                      {Array.from({ length: recentStripUI.pages }).map((_, i) => (
                        <span
                          key={i}
                          className={
                            i === recentStripUI.active
                              ? "h-1.5 w-4 rounded-full bg-foreground/70 motion-safe:transition-all"
                              : "h-1.5 w-1.5 rounded-full bg-muted-foreground/30 motion-safe:transition-all"
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 grid gap-2">
                  {recents.length === 0 ? (
                    <div className="soft-row-card px-3 py-3">
                      <p className="text-sm font-semibold">No recent files yet</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Attach something and it will appear here.
                      </p>
                    </div>
                  ) : (
                    recents.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="soft-row-card soft-row-card-interactive row-pad flex items-center justify-between disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => {
                          setShowAttachmentSheet(false);
                          if (item.kind === "image") openCameraPicker();
                          else openAttachmentPicker();
                        }}
                        disabled={attachDisabled as any}
                        aria-label={`Attach ${item.name}`}
                        title={item.name}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted/60 text-foreground">
                            {item.kind === "image" && item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : item.kind === "audio" ? (
                              <Volume2 className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <FileText className="h-5 w-5" aria-hidden="true" />
                            )}
                          </div>
                          <div className="flex min-w-0 flex-col text-left">
                            <span className="min-w-0 truncate text-sm font-semibold">
                              {item.name}
                            </span>
                            <span className="mt-0.5 text-xs text-muted-foreground">
                              {item.badge} • {item.sizeLabel}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Recent
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <input
          type="file"
          ref={attachmentInputRef}
          accept="image/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/rtf"
          className="hidden"
          onChange={handleAttachmentSelected}
        />

        <div className="flex max-h-[160px] flex-1 items-end gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2 shadow-inner transition-shadow focus-within:ring-2 focus-within:ring-primary/25 focus-within:ring-offset-2 focus-within:ring-offset-background">
          <Textarea
            id="conversation-message"
            value={draft}
            ref={textareaRef}
            rows={1}
            autoComplete="off"
            onChange={handleDraftChange}
            onBlur={stopTyping}
            onPaste={(event) => {
              if (!onAttachmentFile) return;
              if (disableSend || isUploadingAttachment) return;
              const items = event.clipboardData?.items;
              if (!items) return;
              const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
              if (!imageItem) return;
              const file = imageItem.getAsFile();
              if (!file) return;
              event.preventDefault();
              onRequestScrollToBottom?.();
              recordRecentFile(file);
              onAttachmentFile(file);
            }}
            onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === "Enter" && !event.shiftKey) {
                // Enter sends, Shift+Enter inserts a newline.
                if (disableSend || sendButtonDisabled) return;
                if (!draft.trim()) return;
                event.preventDefault();
                onRequestScrollToBottom?.();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Message"
            className="min-h-[38px] max-h-[140px] flex-1 resize-none border-0 bg-transparent px-0 py-0 text-[14px] leading-5 md:text-sm md:leading-6 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
          />
        </div>

        <Button
          type="submit"
          variant="default"
          size="icon"
          className="h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          onMouseDown={(e) => e.preventDefault()}
          disabled={sendButtonDisabled}
          aria-label="Send message"
          aria-busy={isUploadingAttachment}
        >
          {isUploadingAttachment ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </MessageComposer>
  );
};
