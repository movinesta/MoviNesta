import React from "react";

/**
 * Search results skeleton loader (tokenized + compact).
 */
export const SearchSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="flex flex-col stack-gap">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="soft-row-card flex items-center gap-3 row-pad animate-pulse">
          {/* Poster skeleton */}
          <div className="h-20 w-14 shrink-0 rounded-xl bg-muted" />

          {/* Content skeleton */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded-full bg-muted" />
            <div className="h-3 w-1/2 rounded-full bg-muted/80" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-muted/80" />
              <div className="h-6 w-16 rounded-full bg-muted/70" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Card grid skeleton loader (compact spacing).
 */
export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse space-y-2">
          <div className="aspect-[2/3] rounded-2xl bg-muted" />
          <div className="h-3.5 w-3/4 rounded-full bg-muted/90" />
          <div className="h-3 w-1/2 rounded-full bg-muted/70" />
        </div>
      ))}
    </div>
  );
};

/**
 * Profile skeleton loader (tokenized).
 */
export const ProfileSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-1/3 rounded-full bg-muted" />
          <div className="h-3.5 w-1/4 rounded-full bg-muted/70" />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-7 w-16 rounded-xl bg-muted" />
            <div className="h-3 w-20 rounded-full bg-muted/70" />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div className="h-3.5 w-full rounded-full bg-muted/90" />
        <div className="h-3.5 w-5/6 rounded-full bg-muted/80" />
        <div className="h-3.5 w-4/6 rounded-full bg-muted/70" />
      </div>
    </div>
  );
};
