import React from "react";
import { BookmarkPlus, Sparkles, Star } from "lucide-react";
import type { HomeFeedItem } from "./homeFeedTypes";

const avatarColorClassName = {
  teal: "bg-mn-accent-teal/25 text-mn-accent-teal",
  violet: "bg-mn-accent-violet/25 text-mn-accent-violet",
  orange: "bg-mn-primary/20 text-mn-primary",
} as const;

interface HomeFeedItemCardProps {
  item: HomeFeedItem;
}

const StatPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/80 px-2 py-0.5 text-[10px] text-mn-text-secondary shadow-mn-soft">
    {children}
  </span>
);

const TitleBadge: React.FC<{ title: HomeFeedItem["title"] }> = ({ title }) => (
  <div className="flex items-center gap-2">
    <div className="h-12 w-8 overflow-hidden rounded-lg bg-mn-bg-muted shadow-mn-card">
      {title.posterUrl ? (
        <img src={title.posterUrl} alt={title.name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-mn-accent-violet/45 via-mn-bg/40 to-mn-primary/75" />
      )}
    </div>
    <div className="min-w-0">
      <p className="truncate text-[12px] font-medium text-mn-text-primary">{title.name}</p>
      <p className="text-[10px] text-mn-text-muted">{title.year}</p>
    </div>
  </div>
);

const CardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <article className="space-y-2 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/85 p-3 text-[11px] shadow-mn-card">
    {children}
  </article>
);

const UserRow: React.FC<{ item: HomeFeedItem }> = ({ item }) => (
  <header className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColorClassName[item.user.avatarColor]}`}
        aria-hidden
      >
        {item.user.avatarInitials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-mn-text-primary">
          {item.user.displayName}
        </p>
        <p className="text-[10px] text-mn-text-muted">{item.createdAtLabel}</p>
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
          <p className="text-[11px] text-mn-text-secondary">
            Rated {item.rating.toFixed(1)} {item.emoji ?? "⭐️"}
          </p>
          {item.reviewSnippet && (
            <p className="text-[11px] text-mn-text-muted">“{item.reviewSnippet}”</p>
          )}
        </CardShell>
      );
    case "friend-review":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          {item.rating && (
            <p className="text-[11px] text-mn-text-secondary">Rated {item.rating.toFixed(1)}</p>
          )}
          {item.reviewSnippet && (
            <p className="text-[11px] text-mn-text-muted">“{item.reviewSnippet}”</p>
          )}
        </CardShell>
      );
    case "watchlist-add":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          <div className="inline-flex items-center gap-1 text-[11px] text-mn-text-secondary">
            <BookmarkPlus className="h-3 w-3" aria-hidden />
            Added to watchlist
          </div>
          {item.note && <p className="text-[11px] text-mn-text-muted">{item.note}</p>}
        </CardShell>
      );
    case "recommendation":
      return (
        <CardShell>
          <UserRow item={item} />
          <TitleBadge title={item.title} />
          <div className="inline-flex items-center gap-1 text-[11px] text-mn-text-secondary">
            <Sparkles className="h-3 w-3" aria-hidden />
            Recommendation
          </div>
          {item.reason && <p className="text-[11px] text-mn-text-muted">{item.reason}</p>}
        </CardShell>
      );
    default:
      return null;
  }
};

export default HomeFeedItemCard;
