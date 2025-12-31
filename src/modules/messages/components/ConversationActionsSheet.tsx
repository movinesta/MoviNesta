import React from "react";
import { Check, EyeOff, BellOff, Bell, MailOpen, Mail } from "lucide-react";

import type { ConversationListItem } from "../useConversations";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/material-icon";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationListItem | null;
  isMuted: boolean;
  isHidden: boolean;
  onToggleMute: () => void;
  onToggleHidden: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onOpenConversation: () => void;
};

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  onClick: () => void;
  destructive?: boolean;
}> = ({ icon, title, description, onClick, destructive }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" +
      (destructive ? " text-destructive" : "")
    }
  >
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/80">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold">{title}</span>
      {description ? (
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      ) : null}
    </span>
  </button>
);

export const ConversationActionsSheet: React.FC<Props> = ({
  open,
  onOpenChange,
  conversation,
  isMuted,
  isHidden,
  onToggleMute,
  onToggleHidden,
  onMarkRead,
  onMarkUnread,
  onOpenConversation,
}) => {
  const close = () => onOpenChange(false);

  const handle = (fn: () => void) => {
    fn();
    close();
  };

  const canMarkRead = Boolean(conversation?.lastMessageId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 right-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-3xl rounded-b-none border border-border bg-card p-4">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted" aria-hidden />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="text-center text-base text-foreground">
              {conversation?.title ?? "Conversation"}
            </DialogTitle>
            <p className="mt-1 text-center text-xs text-muted-foreground">Quick actions</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            aria-label="Close"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="mt-3 space-y-1">
          <Row
            icon={<Check className="h-5 w-5 text-muted-foreground" aria-hidden />}
            title="Open chat"
            description="Jump back into this conversation"
            onClick={() => handle(onOpenConversation)}
          />

          {conversation?.hasUnread ? (
            <Row
              icon={<MailOpen className="h-5 w-5 text-muted-foreground" aria-hidden />}
              title="Mark as read"
              description={canMarkRead ? "Clear unread badge" : "No messages yet"}
              onClick={() => handle(onMarkRead)}
            />
          ) : (
            <Row
              icon={<Mail className="h-5 w-5 text-muted-foreground" aria-hidden />}
              title="Mark as unread"
              description="Bring it back to your attention"
              onClick={() => handle(onMarkUnread)}
            />
          )}

          <Row
            icon={
              isMuted ? (
                <Bell className="h-5 w-5 text-muted-foreground" aria-hidden />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden />
              )
            }
            title={isMuted ? "Unmute" : "Mute"}
            description="Stops message notifications on all devices"
            onClick={() => handle(onToggleMute)}
          />

          <Row
            icon={<EyeOff className="h-5 w-5 text-muted-foreground" aria-hidden />}
            title={isHidden ? "Unhide" : "Hide"}
            description="Removes it from your inbox list"
            onClick={() => handle(onToggleHidden)}
          />
        </div>

        <div className="pt-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-2xl border border-border bg-muted/60 text-foreground hover:bg-muted"
            onClick={close}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
