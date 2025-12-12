import React from "react";
import { Link } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";
import { BookmarkPlus, Film, MessageCircle, Sparkles, Star, Users } from "lucide-react";
import { useDiaryTimeline, type DiaryTimelineItem } from "./useDiaryTimeline";
import { formatDateTime } from "@/utils/format";

interface DiaryTimelineTabProps {
  userId?: string | null;
  isOwnProfile?: boolean;
  displayName?: string | null;
  username?: string | null;
}

const eventLabel = (item: DiaryTimelineItem): string => {
  switch (item.kind) {
    case "rating":
      return item.rating != null ? `Rated ${item.rating.toFixed(1)}★` : "Rated";
    case "review":
      return "Wrote a review";
    case "watchlist":
      return "Updated watchlist";
    case "follow":
      return "Followed someone";
    default:
      return "Activity";
  }
};

const eventIcon = (kind: DiaryTimelineItem["kind"]) => {
  switch (kind) {
    case "rating":
      return Star;
    case "review":
      return MessageCircle;
    case "watchlist":
      return BookmarkPlus;
    case "follow":
      return Users;
    default:
      return Sparkles;
  }
};

const DiaryTimelineTab: React.FC<DiaryTimelineTabProps> = ({
  userId,
  isOwnProfile = false,
  displayName,
  username,
}) => {
  const { items, isLoading, isError, error } = useDiaryTimeline(userId);

  const nameLabel = displayName || (username ? `@${username}` : "this user");

  if (isLoading) {
    return (
      <div className="px-2 pb-4">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="flex gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-lg"
            >
              <div className="h-12 w-8 rounded bg-background/60" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-3 w-1/3 rounded bg-background/70" />
                <div className="h-3 w-2/3 rounded bg-background/80" />
                <div className="h-2.5 w-1/2 rounded bg-background/80" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-center text-xs text-foreground shadow-lg">
          <p className="font-semibold">
            Unable to load {isOwnProfile ? "your" : "this profile&apos;s"} activity.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error ?? "Please try again in a moment."}
          </p>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border border-border bg-card/80 p-5 text-center text-xs text-muted-foreground shadow-lg">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
            <Film className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <p className="font-heading text-sm font-semibold text-foreground">
            {isOwnProfile ? "Your diary is waiting" : `${nameLabel}'s diary is quiet`}
          </p>
          <p className="mt-1 text-xs">
            {isOwnProfile
              ? "As you rate titles, write reviews, and update your library, they’ll show up here in a cozy, chronological timeline."
              : "When they rate titles, share reviews, or log films, their updates will collect here for you to browse."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pb-4">
      <Virtuoso
        style={{ height: "70vh" }}
        data={items}
        computeItemKey={(_, item) => item.id}
        components={{
          List: React.forwardRef<HTMLOListElement, React.HTMLAttributes<HTMLOListElement>>(
            function List(props, ref) {
              return <ol ref={ref} className="space-y-3" {...props} />;
            },
          ) as any,
        }}
        itemContent={(index, item) => {
          const Icon = eventIcon(item.kind);
          const titleUrl = item.titleId ? `/title/${item.titleId}` : null;

          return (
            <li key={item.id} className="pb-1">
              <article className="flex gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-lg">
                <div className="relative h-16 w-11 overflow-hidden rounded bg-background/70">
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.title ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      <Film className="mr-1 h-3.5 w-3.5" />
                      No poster
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-foreground">
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {eventLabel(item)}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  <div className="min-w-0">
                    {titleUrl ? (
                      <Link
                        to={titleUrl}
                        className="line-clamp-2 text-sm font-medium text-foreground hover:underline"
                      >
                        {item.title ?? "Untitled"}
                        {item.year ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({item.year})
                          </span>
                        ) : null}
                      </Link>
                    ) : (
                      <p className="line-clamp-2 text-sm font-medium text-foreground">
                        {item.title ?? "Activity"}
                      </p>
                    )}
                  </div>

                  {item.reviewSnippet && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      “{item.reviewSnippet}”
                    </p>
                  )}

                  {item.extra && <p className="text-xs text-muted-foreground">{item.extra}</p>}
                </div>
              </article>
            </li>
          );
        }}
      />
    </div>
  );
};

export default DiaryTimelineTab;
