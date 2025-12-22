import React from "react";
import { BookmarkPlus, Sparkles, Star } from "lucide-react";
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
      <p className="text-xs text-muted-foreground">{title.year}</p>
    </div>
  </div>
);

const CardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <article className="space-y-2 rounded-2xl border border-border bg-card/85 p-3 text-xs shadow-lg">
    {children}
  </article>
);

const UserRow: React.FC<{ item: HomeFeedItem }> = ({ item }) => (
  <header className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${avatarColorClassName[item.user.avatarColor]}`}
        aria-hidden
      >
        {item.user.avatarInitials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-foreground">
          {item.user.displayName}
        </p>
        <p className="text-xs text-muted-foreground">{item.createdAtLabel}</p>
      </div>
    </div>
    {item.kind === "friend-rating" && (
      <StatPill>
        <Star className="h-3 w-3" aria-hidden />
        <span>{item.rating.toFixed(1)}</span>
      </StatPill>
    )}
    {item.kind === "recommendation" && item.score !== undefined && (
      <StatPill>
        <Sparkles className="h-3 w-3" aria-hidden />
        <span>{item.score.toFixed(1)}</span>
      </StatPill>
    )}
  </header>
);

const HomeFeedItemCard: React.FC<HomeFeedItemCardProps> = ({ item }) => {
  switch (item.kind) {
    case "friend-rating":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          <p className="text-xs text-muted-foreground">
            Rated {item.rating.toFixed(1)} {item.emoji ?? "⭐️"}
          </p>
          {item.reviewSnippet && (
            <p className="text-xs text-muted-foreground">“{item.reviewSnippet}”</p>
          )}
        </CardShell>
      );
    case "friend-review":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          {item.rating && (
            <p className="text-xs text-muted-foreground">Rated {item.rating.toFixed(1)}</p>
          )}
          {item.reviewSnippet && (
            <p className="text-xs text-muted-foreground">“{item.reviewSnippet}”</p>
          )}
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
    case "recommendation":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden />
            Recommendation
          </div>
          {item.reason && <p className="text-xs text-muted-foreground">{item.reason}</p>}
        </CardShell>
      );
    default:
      return null;
  }
};

export default HomeFeedItemCard;
