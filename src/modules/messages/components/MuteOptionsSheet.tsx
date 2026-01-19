import React from "react";
import { Clock, BellOff } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/material-icon";

export type MutePreset =
  | { kind: "duration"; minutes: number; label: string; description: string }
  | { kind: "indefinite"; label: string; description: string };

const PRESETS: MutePreset[] = [
  { kind: "duration", minutes: 60, label: "1 hour", description: "Mute notifications for 1 hour" },
  {
    kind: "duration",
    minutes: 8 * 60,
    label: "8 hours",
    description: "Mute notifications for 8 hours",
  },
  {
    kind: "duration",
    minutes: 24 * 60,
    label: "24 hours",
    description: "Mute notifications for 24 hours",
  },
  {
    kind: "indefinite",
    label: "Until I turn it back on",
    description: "Mute notifications until you unmute manually",
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationTitle?: string | null;
  onSelect: (preset: MutePreset) => void;
};

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}> = ({ icon, title, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="soft-row-card soft-row-card-interactive flex w-full items-center gap-3 row-pad text-left transition"
  >
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/80">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold">{title}</span>
      <span className="block truncate text-xs text-muted-foreground">{description}</span>
    </span>
  </button>
);

export const MuteOptionsSheet: React.FC<Props> = ({
  open,
  onOpenChange,
  conversationTitle,
  onSelect,
}) => {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 right-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-3xl rounded-b-none border border-border bg-card card-pad">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted" aria-hidden />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="text-center text-base text-foreground">
              Mute notifications
            </DialogTitle>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {conversationTitle ? conversationTitle : "Choose a duration"}
            </p>
          </div>
          <button type="button" onClick={close} className="icon-hit" aria-label="Close">
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="mt-3 space-y-1">
          {PRESETS.map((preset) => (
            <Row
              key={preset.label}
              icon={
                preset.kind === "duration" ? (
                  <Clock className="h-5 w-5 text-muted-foreground" aria-hidden />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden />
                )
              }
              title={preset.label}
              description={preset.description}
              onClick={() => {
                onSelect(preset);
                close();
              }}
            />
          ))}
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
