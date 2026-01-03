import React from "react";
import { Film, Sparkles } from "lucide-react";

export const TonightPickSkeleton: React.FC = () => {
  return (
    <section className="animate-pulse rounded-2xl border border-border bg-card/90 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="h-4 w-32 rounded-full bg-border/60" />
        <div className="h-4 w-16 rounded-full bg-border/40" />
      </div>
      <div className="flex gap-3">
        <div className="h-28 w-20 rounded-2xl bg-border/60" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded-full bg-border/60" />
          <div className="h-3 w-full rounded-full bg-border/40" />
          <div className="h-3 w-5/6 rounded-full bg-border/40" />
          <div className="mt-2 flex gap-2">
            <div className="h-7 w-28 rounded-full bg-border/50" />
            <div className="h-7 w-28 rounded-full bg-border/40" />
          </div>
        </div>
      </div>
    </section>
  );
};

export const CarouselsSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      {[0, 1].map((rowIndex) => (
        <section key={rowIndex} className="space-y-2">
          <div className="h-4 w-40 rounded-full bg-border/60" />
          <div className="-mx-1 overflow-x-hidden pb-1">
            <div className="flex gap-2 px-1">
              {[0, 1, 2].map((cardIdx) => (
                <div
                  key={cardIdx}
                  className="h-40 w-[160px] shrink-0 rounded-2xl border border-border bg-card/80"
                />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

export const EmptyTonightPickState: React.FC = () => {
  return (
    <section className="rounded-2xl border border-border bg-card/95 px-4 py-5 text-xs text-muted-foreground shadow-lg">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden={true} />
        </div>
        <h2 className="text-sm font-heading font-semibold text-foreground">
          Smart picks arrive as you watch
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Once you&apos;ve logged a few titles and swiped through recommendations, MoviNesta will
          start surfacing a single “tonight&apos;s pick” tuned to your taste.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          For now, head to <span className="font-medium text-foreground">Swipe</span> or{" "}
          <span className="font-medium text-foreground">Diary</span> to teach the nest what you
          love.
        </p>
      </div>
    </section>
  );
};

export const EmptyForYouState: React.FC = () => {
  return (
    <section className="rounded-2xl border border-border bg-card/95 px-4 py-4 text-xs text-muted-foreground shadow-lg">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-primary/15">
          <Film className="h-4 w-4 text-primary" aria-hidden={true} />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-heading font-semibold text-foreground">
            No personalized rows yet
          </h3>
          <p className="text-xs text-muted-foreground">
            As you rate, review, and follow friends, this tab will fill with eerily good
            recommendations.
          </p>
        </div>
      </div>
    </section>
  );
};
