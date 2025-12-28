import React from "react";
import { BookmarkMinus, BookmarkPlus, Sparkles, Star } from "lucide-react";
import type { HomeFeedItem } from "./homeFeedTypes";
import { Chip } from "@/components/ui/Chip";

const avatarColorClassName = {
  teal: "bg-primary/25 text-primary",
  violet: "bg-primary/25 text-primary",
  orange: "bg-primary/20 text-primary",
} as const;

interface HomeFeedItemCardProps {
  item: HomeFeedItem;
}

const StatPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Chip className="gap-1 px-2 py-0.5 text-xs shadow-md">{children}</Chip>
);

const TitleBadge: React.FC<{ title: HomeFeedItem["title"] }> = ({ title }) => (
  <div className="flex items-center gap-2">
    <div className="h-12 w-8 overflow-hidden rounded-lg bg-muted shadow-lg">
      {title.posterUrl ? (
        <img src={title.posterUrl} alt={title.name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary/45 via-background/40 to-primary/75" />
      )}
    </div>
    <div className="min-w-0">
      <p className="truncate text-[12px] font-medium text-foreground">{title.name}</p>
      <p className="text-xs text-muted-foreground">{title.mediaType ?? "title"}</p>
    </div>
  </div>
);

const UserRow: React.FC<{ item: HomeFeedItem }> = ({ item }) => {
  const u = item.user;
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid h-9 w-9 place-items-center overflow-hidden rounded-full ${
          avatarColorClassName[u.avatarColor]
        }`}
      >
        {u.avatarUrl ? (
          <img src={u.avatarUrl} alt={u.displayName} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold">{u.displayName.slice(0, 2).toUpperCase()}</span>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{u.displayName}</p>
        <p className="text-xs text-muted-foreground">{item.relativeTime}</p>
      </div>
    </div>
  );
};

const CardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-border/50 bg-card/60 p-4 shadow-md backdrop-blur">
    <div className="flex flex-col gap-3">{children}</div>
  </div>
);

const HomeFeedItemCard: React.FC<HomeFeedItemCardProps> = ({ item }) => {
  switch (item.kind) {
    case "friend-rating":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          <div className="flex flex-wrap items-center gap-2">
            <StatPill>
              <Star className="h-3 w-3" aria-hidden />
              <span className="font-medium">{item.rating}/5</span>
            </StatPill>
            {item.emoji && <StatPill>{item.emoji}</StatPill>}
          </div>
          {item.reviewSnippet && <p className="text-xs text-muted-foreground">“{item.reviewSnippet}”</p>}
        </CardShell>
      );

    case "friend-review":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          <div className="flex flex-wrap items-center gap-2">
            {typeof item.rating === "number" && (
              <StatPill>
                <Star className="h-3 w-3" aria-hidden />
                <span className="font-medium">{item.rating}/5</span>
              </StatPill>
            )}
            {item.emoji && <StatPill>{item.emoji}</StatPill>}
          </div>
          {item.reviewSnippet && <p className="text-xs text-muted-foreground">“{item.reviewSnippet}”</p>}
        </CardShell>
      );

    case "watchlist-add":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <BookmarkPlus className="h-3 w-3" aria-hidden />
            Added to watchlist
          </div>
          {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
        </CardShell>
      );

    case "watchlist-remove":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <BookmarkMinus className="h-3 w-3" aria-hidden />
            Removed from watchlist
          </div>
        </CardShell>
      );

    case "recommendation":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden />
            Recommended for you
          </div>
          {item.reason && <p className="text-xs text-muted-foreground">{item.reason}</p>}
        </CardShell>
      );

    default:
      return null;
  }
};

// ✅ Keep both exports so other files can import either way
export { HomeFeedItemCard };
export default HomeFeedItemCard;
