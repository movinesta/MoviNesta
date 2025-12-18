import React from "react";
import { ImageOff } from "lucide-react";
import type { SwipeCardData } from "./useSwipeDeck";

interface CardMetadataProps {
  card: SwipeCardData;
  metaLine: string;
  highlightLabel: string | null;
}

export const CardMetadata: React.FC<CardMetadataProps> = ({ card, metaLine, highlightLabel }) => {
  return (
    <div className="space-y-2 text-left leading-relaxed" aria-label="Swipe card summary">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="line-clamp-2 text-2xl font-heading font-semibold text-foreground">
            {card.title}
          </h2>
          {metaLine && <p className="truncate text-xs text-muted-foreground/90">{metaLine}</p>}
          {highlightLabel && (
            <p className="text-xs font-medium text-primary/90">{highlightLabel}</p>
          )}
        </div>
      </div>
      {card.tagline && !card.tagline.trim().startsWith("Plot") && (
        <p className="line-clamp-2 text-xs text-muted-foreground/90">{card.tagline}</p>
      )}
    </div>
  );
};

export const PosterFallback: React.FC<{ title?: string }> = ({ title }) => (
  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-background via-card to-background text-center">
    <div className="flex flex-col items-center gap-2 text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card/70 shadow-md">
        <ImageOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <span className="text-[12px] font-semibold">Artwork unavailable</span>
      {title && (
        <span className="max-w-[240px] truncate text-xs text-muted-foreground/80">for {title}</span>
      )}
    </div>
  </div>
);

export const LoadingSwipeCard: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <p>Getting picks...</p>
      <p>Finding what friends like...</p>
    </div>
  );
};
