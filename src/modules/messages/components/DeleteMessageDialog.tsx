import React from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DeleteMessageDialogState {
  messageId: string;
  attachmentUrl: string | null;
}

export interface DeleteMessageDialogProps {
  open: boolean;
  deleteDialog: DeleteMessageDialogState | null;
  onOpenChange: (open: boolean) => void;
  onHideForMe: () => void;
  onDeleteForEveryone: () => void;
  isDeleting: boolean;
}

export const DeleteMessageDialog: React.FC<DeleteMessageDialogProps> = ({
  open,
  deleteDialog,
  onOpenChange,
  onHideForMe,
  onDeleteForEveryone,
  isDeleting,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="gap-1">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Trash2 className="h-4 w-4" aria-hidden />
            </span>
            Delete message
          </DialogTitle>
          <DialogDescription>
            Choose whether to hide this message only for you or delete it for everyone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onHideForMe}
            disabled={!deleteDialog}
          >
            Hide for me
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={isDeleting || !deleteDialog}
            onClick={onDeleteForEveryone}
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Delete for everyone</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
