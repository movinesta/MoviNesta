import React from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkPlus, Plus, Sparkles, Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CreateActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}> = ({ icon, title, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
  >
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-white">{title}</span>
      <span className="block truncate text-xs text-white/60">{description}</span>
    </span>
  </button>
);

const CreateActionSheet: React.FC<CreateActionSheetProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();

  const close = () => onOpenChange(false);

  const go = (path: string) => {
    close();
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          "left-0 right-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-3xl rounded-b-none border border-white/10 bg-black p-4"
        }
      >
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-white/15" aria-hidden />
        <DialogHeader className="pb-1">
          <DialogTitle className="text-center text-base text-white">Create</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-1">
          <Row
            icon={<Plus className="h-5 w-5 text-white" aria-hidden />}
            title="Log a movie"
            description="Pick a title and add it to your diary"
            onClick={() => go("/search")}
          />
          <Row
            icon={<Star className="h-5 w-5 text-white" aria-hidden />}
            title="Write a review"
            description="Find a title and leave your thoughts"
            onClick={() => go("/search")}
          />
          <Row
            icon={<BookmarkPlus className="h-5 w-5 text-white" aria-hidden />}
            title="Create a highlight"
            description="Make a new list (Top movies, etc.)"
            onClick={() => go("/me?createHighlight=1")}
          />
          <Row
            icon={<Sparkles className="h-5 w-5 text-white" aria-hidden />}
            title="Discover"
            description="Explore trending picks"
            onClick={() => go("/search")}
          />
        </div>

        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={close}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateActionSheet;
