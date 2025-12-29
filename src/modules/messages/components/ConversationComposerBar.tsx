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

  typingUsers: string[];
  isGroupConversation: boolean;

  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;

  noteLocalInputActivity: (isTyping: boolean) => void;
  stopTyping: () => void;
  onSendText: (text: string) => void;

  isUploadingImage: boolean;
  cancelImageUpload: () => void;

  sendError: boolean;
  canRetrySend: boolean;
  onRetrySend: () => void;

  uploadError: string | null;
  clearUploadError: () => void;

  showEmojiPicker: boolean;
  setShowEmojiPicker: (open: boolean) => void;

  openCameraPicker: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;

  isSending: boolean;
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

const QUICK_REACTIONS = [
  { emoji: "🍿", label: "Popcorn" },
  { emoji: "⭐", label: "Rate" },
  { emoji: "🎬", label: "Slate" },
  { emoji: "👍", label: "Like" },
] as const;

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
  isUploadingImage,
  cancelImageUpload,
  sendError,
  canRetrySend,
  onRetrySend,
  uploadError,
  clearUploadError,
  showEmojiPicker,
  setShowEmojiPicker,
  openCameraPicker,
  fileInputRef,
  onImageSelected,
  isSending,
  disableSend,
}) => {
  const handleDraftChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
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

      if (disableSend) return;
      const text = draft.trim();
      if (!text) return;

      setDraft("");
      stopTyping();
      onSendText(text);
    },
    [disableSend, draft, onSendText, setDraft, stopTyping],
  );

  if (!show) return null;

  const sendButtonDisabled = disableSend || !draft.trim() || isSending || isUploadingImage;
  const cameraDisabled = isUploadingImage || isSending || disableSend;

  return (
    <MessageComposer
      onSubmit={handleSubmit}
      className="space-y-3"
      onHeightChange={onHeightChange}
      minHeight={headerHeight}
    >
      <div className="flex items-center gap-3 overflow-x-auto px-1 pb-1 text-xs text-muted-foreground">
        <span className="shrink-0 font-semibold uppercase tracking-wide">React:</span>
        {QUICK_REACTIONS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleEmojiSelect(item.emoji)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/60 hover:text-foreground"
          >
            <span className="text-base">{item.emoji}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      {typingUsers.length > 0 && (
        <div className="flex items-center justify-start gap-2 text-xs text-muted-foreground">
          <span>
            {isGroupConversation
              ? typingUsers.length === 1
                ? `${typingUsers[0]} is typing…`
                : typingUsers.length === 2
                  ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
                  : "Several people are typing…"
              : "Typing…"}
          </span>
          <span className="inline-flex items-center gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
          </span>
        </div>
      )}

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
            <p className="font-semibold">Couldn&apos;t send. Please try again.</p>
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
            onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (draft.trim()) {
                  event.currentTarget.form?.requestSubmit();
                }
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
          aria-busy={isSending || isUploadingImage}
        >
          {isSending || isUploadingImage ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </MessageComposer>
  );
};
