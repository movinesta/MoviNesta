import type { DiaryStatus } from "./useDiaryLibrary";

export const diaryStatusLabel = (status: DiaryStatus | null | undefined): string => {
  switch (status) {
    case "want_to_watch":
      return "Want to watch";
    case "watching":
      return "Watching";
    case "watched":
      return "Watched";
    case "dropped":
      return "Dropped";
    default:
      return "Tap to add status";
  }
};

export const diaryStatusPillClasses = (status: DiaryStatus | null | undefined): string => {
  switch (status) {
    case "want_to_watch":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "watching":
      return "border-sky-500/40 bg-sky-500/10 text-sky-200";
    case "watched":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "dropped":
      return "border-rose-500/40 bg-rose-500/10 text-rose-200";
    default:
      return "border-border bg-background/60 text-muted-foreground";
  }
};
