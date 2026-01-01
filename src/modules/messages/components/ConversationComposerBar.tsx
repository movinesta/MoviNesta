import React, { useCallback } from "react";
import { AlertCircle, Camera, Loader2, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageComposer } from "./MessageComposer";

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

  isUploadingImage: boolean;
  cancelImageUpload: () => void;

  sendError: boolean;
  sendErrorMessage?: string | null;
  canRetrySend: boolean;
  onRetrySend: () => void;

  uploadError: string | null;
  clearUploadError: () => void;

  showEmojiPicker: boolean;
  setShowEmojiPicker: (open: boolean) => void;

  openCameraPicker: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImageFile?: (file: File) => void;
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

const MAX_MESSAGE_CHARS = 2000;

export const ConversationComposerBar: React.FC<Props> = ({
  show,
  headerHeight,
  onHeightChange,
  typingUsers,
  isGroupConversation,
  draft,
  setDraft,
  textareaRef,
  noteLocalInputActivity,
  stopTyping,
  onSendText,
  onRequestScrollToBottom,
  isUploadingImage,
  cancelImageUpload,
  sendError,
  sendErrorMessage,

  canRetrySend,
  onRetrySend,
  uploadError,
  clearUploadError,
  showEmojiPicker,
  setShowEmojiPicker,
  openCameraPicker,
  fileInputRef,
  onImageSelected,
  onImageFile,
  disableSend,
}) => {
  const handleDraftChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextRaw = event.target.value;
      const next =
        nextRaw.length > MAX_MESSAGE_CHARS ? nextRaw.slice(0, MAX_MESSAGE_CHARS) : nextRaw;
      setDraft(next);
      if (showEmojiPicker) setShowEmojiPicker(false);
      noteLocalInputActivity(next.trim().length > 0);

      // Auto-size within a safe cap.
      const el = event.target;
      el.style.height = "auto";
      const nextHeight = Math.min(el.scrollHeight, 140);
      el.style.height = `${nextHeight}px`;
    },
    [noteLocalInputActivity, setDraft, setShowEmojiPicker, showEmojiPicker],
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
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
      });
    },
    [noteLocalInputActivity, setDraft, textareaRef],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      // Do not block sending while a previous send is still in-flight.
      // Users should be able to send multiple messages quickly (Instagram-like).
      if (disableSend || isUploadingImage) return;
      const text = draft.trim();
      if (!text) return;

      setDraft("");
      stopTyping();
      onSendText(text);
    },
    [
      disableSend,
      draft,
      isUploadingImage,
      onSendText,
      setDraft,
      stopTyping,
    ],
  );

  if (!show) return null;

  const sendButtonDisabled = disableSend || !draft.trim() || isUploadingImage;
  const cameraDisabled = isUploadingImage || disableSend;

  return (
    <MessageComposer
      onSubmit={handleSubmit}
      className="space-y-2"
      onHeightChange={onHeightChange}
      minHeight={headerHeight}
      onDragOver={(event) => {
        if (!onImageFile || disableSend) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        (event.currentTarget as any).dataset.dragging = "true";
      }}
      onDragLeave={(event) => {
        (event.currentTarget as any).dataset.dragging = "false";
      }}
      onDrop={(event) => {
        if (!onImageFile || disableSend || isUploadingImage) return;
        event.preventDefault();
        (event.currentTarget as any).dataset.dragging = "false";
        const files = event.dataTransfer.files;
        if (!files || files.length === 0) return;
        const image = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!image) return;
        onImageFile(image);
      }}
    >
      {/* Typing indicator is now rendered Instagram-style in the message list footer. */}

      {isUploadingImage && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <p className="font-semibold text-foreground">Uploading image…</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={cancelImageUpload}>
            Cancel
          </Button>
        </div>
      )}

      {sendError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5" aria-hidden="true" />
            <p className="font-semibold">
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
          className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <p className="font-semibold">{uploadError}</p>
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
              className="h-9 w-9 rounded-full bg-muted/60 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
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
                    className="h-9 w-9 rounded-xl text-lg transition hover:bg-muted/60"
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
          className="h-9 w-9 rounded-full bg-muted/60 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
          onClick={openCameraPicker}
          aria-label="Send photo"
          disabled={cameraDisabled}
          aria-busy={isUploadingImage}
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={onImageSelected}
        />

        <div className="flex max-h-[160px] flex-1 items-end gap-2 rounded-2xl border border-border bg-background/60 px-3 py-2 shadow-inner">
          <Textarea
            id="conversation-message"
            value={draft}
            ref={textareaRef}
            rows={1}
            autoComplete="off"
            onChange={handleDraftChange}
            onBlur={stopTyping}
            onPaste={(event) => {
              if (!onImageFile) return;
              if (disableSend || isUploadingImage) return;
              const items = event.clipboardData?.items;
              if (!items) return;
              const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
              if (!imageItem) return;
              const file = imageItem.getAsFile();
              if (!file) return;
              event.preventDefault();
              onRequestScrollToBottom?.();
              onImageFile(file);
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
            className="min-h-[38px] max-h-[140px] flex-1 resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
          />
        </div>

        <Button
          type="submit"
          variant="default"
          size="icon"
          className="h-10 w-10 rounded-full bg-primary text-white shadow-sm hover:bg-primary/90"
          onMouseDown={(e) => e.preventDefault()}
          disabled={sendButtonDisabled}
          aria-label="Send message"
          aria-busy={isUploadingImage}
        >
          {isUploadingImage ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

    </MessageComposer>
  );
};
