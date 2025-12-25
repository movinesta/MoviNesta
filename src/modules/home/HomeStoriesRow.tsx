import React from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useHomeStories } from "./useHomeStories";
import { cn } from "@/lib/utils";

const ringClass =
  "bg-gradient-to-tr from-fuchsia-500 via-amber-400 to-pink-500";

const AvatarCircle: React.FC<{
  src: string | null;
  label: string;
  showPlus?: boolean;
  onClick: () => void;
  muted?: boolean;
}> = ({ src, label, showPlus, onClick, muted }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-20 flex-col items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      aria-label={label}
    >
      <span className={cn("relative inline-flex h-16 w-16 items-center justify-center rounded-full p-[2px]", muted ? "bg-muted" : ringClass)}>
        <span className="relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-muted">
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">?</span>
          )}
          {showPlus ? (
            <span className="absolute bottom-0 right-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-background">
              <Plus className="h-3.5 w-3.5 text-white" aria-hidden />
            </span>
          ) : null}
        </span>
      </span>
      <span className="w-20 truncate text-center text-[11px] text-foreground">{label}</span>
    </button>
  );
};

const HomeStoriesRow: React.FC = () => {
  const navigate = useNavigate();
  const { data: stories, isLoading } = useHomeStories();

  // Skeleton row
  if (isLoading) {
    return (
      <div className="-mx-4 border-b border-border bg-background px-4 py-3">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex w-20 flex-col items-center gap-1">
              <div className="h-16 w-16 rounded-full bg-muted" />
              <div className="h-2 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const items = stories ?? [];

  if (!items.length) {
    return (
      <div className="-mx-4 border-b border-border bg-background px-4 py-3">
        <div className="text-sm text-muted-foreground">Follow people to see their highlights here.</div>
      </div>
    );
  }

  return (
    <div className="-mx-4 border-b border-border bg-background px-4 py-3">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((s, idx) => {
          const label = idx === 0 ? "Your story" : s.listName || s.username || "Story";
          const to =
            idx === 0
              ? "/me?createHighlight=1"
              : s.listId
                ? `/lists/${s.listId}`
                : s.username
                  ? `/u/${s.username}`
                  : "/me";
          return (
            <AvatarCircle
              key={`${s.userId}:${s.listId ?? "none"}`}
              src={s.avatarUrl}
              label={label}
              showPlus={idx === 0}
              muted={idx === 0}
              onClick={() => navigate(to)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default HomeStoriesRow;
