import React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EditMessageDialogState {
  messageId: string;
  text: string;
  body: string | null;
  attachmentUrl: string | null;
}

export interface EditMessageDialogProps {
  open: boolean;
  editingMessage: EditMessageDialogState | null;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onTextChange: (text: string) => void;
  onSave: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  error: string | null;
  isSaving: boolean;
}

export const EditMessageDialog: React.FC<EditMessageDialogProps> = ({
  open,
  editingMessage,
  onOpenChange,
  onCancel,
  onTextChange,
  onSave,
  textareaRef,
  error,
  isSaving,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit message</DialogTitle>
          <DialogDescription>
            Update your message for everyone in the conversation.
          </DialogDescription>
        </DialogHeader>

        {editingMessage && (
          <Textarea
            ref={textareaRef}
            value={editingMessage.text}
            onChange={(event) => onTextChange(event.target.value)}
            rows={3}
            className="min-h-[120px]"
          />
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!editingMessage?.text.trim() || isSaving}
            onClick={onSave}
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Save</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
