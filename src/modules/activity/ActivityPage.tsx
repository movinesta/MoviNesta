import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";

import TopBar from "@/components/shared/TopBar";
import { Button } from "@/components/ui/button";
import VerifiedBadge from "@/components/VerifiedBadge";
import { cn } from "@/lib/utils";
import { useToggleFollow } from "@/modules/search/useToggleFollow";

import {
  useActivityNotifications,
  type ActivityNotification,
  type ActivityActor,
} from "./useActivityNotifications";

const formatTimeAgo = (iso: string) => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4, "week"],
    [12, "month"],
  ];

  let value = diffSec;
  let unit: Intl.RelativeTimeFormatUnit = "second";

  for (const [limit, nextUnit] of ranges) {
    if (Math.abs(value) < limit) {
      unit = nextUnit;
      break;
    }
    value = Math.floor(value / limit);
    unit = nextUnit;
  }

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return rtf.format(-value, unit);
};

const isWithinDays = (iso: string, days: number) => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  return diffMs <= days * 24 * 60 * 60 * 1000;
};

const ActorAvatar: React.FC<{ actor: ActivityActor }> = ({ actor }) => {
  const initials = (actor.displayName || actor.username || "?")
    .replace(/^@/, "")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return actor.avatarUrl ? (
    <img src={actor.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
  ) : (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initials || "?"}
    </div>
  );
};

const NotificationRow: React.FC<{
  item: ActivityNotification;
  onDismiss: () => void;
  onOpen: () => void;
  onFollowBack?: () => void;
  followBackState?: { label: string; disabled?: boolean };
}> = ({ item, onDismiss, onOpen, onFollowBack, followBackState }) => {
  const time = formatTimeAgo(item.createdAt);
  const name = item.actor.displayName || item.actor.username || "Someone";

  return (
    <div className="soft-row-card flex min-h-11 items-center gap-3 row-pad">
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <ActorAvatar actor={item.actor} />
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <p className="text-sm text-foreground">
          <span className="inline-flex items-center gap-1 font-semibold">
            {name}
            {item.actor.isVerified ? (
              <VerifiedBadge
                isVerified={item.actor.isVerified ?? null}
                type={(item.actor.verifiedType as any) ?? null}
                label={item.actor.verifiedLabel ?? null}
                verifiedAt={item.actor.verifiedAt ?? null}
                org={item.actor.verifiedByOrg ?? null}
              />
            ) : null}
          </span>{" "}
          <span className="text-muted-foreground">{item.text.replace(name, "").trim()}</span>{" "}
          <span className="text-xs text-muted-foreground">{time}</span>
        </p>
      </button>

      <div className="flex items-center gap-2">
        {item.thumbnailUrl ? (
          <button
            type="button"
            onClick={onOpen}
            className="h-12 w-12 overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Open"
          >
            <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ) : null}

        {onFollowBack && followBackState ? (
          <Button
            size="sm"
            className="h-9 rounded-full px-4"
            onClick={onFollowBack}
            disabled={followBackState.disabled}
          >
            {followBackState.label}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="icon-hit"
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </h2>
    <div className="flex flex-col gap-2">{children}</div>
  </section>
);

const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useActivityNotifications();
  const toggleFollow = useToggleFollow();

  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  const notifications = React.useMemo(() => {
    const all = data?.notifications ?? [];
    return all.filter((n) => !dismissed.has(n.id));
  }, [data?.notifications, dismissed]);

  const peopleYouDontFollowBack = data?.peopleYouDontFollowBack ?? [];

  const last30Days = notifications.filter((n) => isWithinDays(n.createdAt, 30));
  const older = notifications.filter((n) => !isWithinDays(n.createdAt, 30));

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const openNotification = (item: ActivityNotification) => {
    if (item.linkTo) navigate(item.linkTo);
  };

  const handleFollowBack = (item: ActivityNotification) => {
    toggleFollow.mutate({
      targetUserId: item.actor.id,
      currentlyFollowing: Boolean(item.isFollowingBack),
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 bg-background pb-3 text-foreground">
      <TopBar title="Activity" />

      <div className="flex flex-1 flex-col gap-2.5 px-[var(--page-pad-x)]">
        {/* Follow requests (placeholder) */}
        <button
          type="button"
          className="soft-row-card soft-row-card-interactive flex w-full min-h-11 items-center justify-between gap-3 px-[var(--row-pad-x)] py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={() => navigate("/activity/requests")}
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-muted" />
            <div>
              <div className="text-sm font-semibold">Follow requests</div>
              <div className="text-xs text-muted-foreground">
                {peopleYouDontFollowBack.length
                  ? `${peopleYouDontFollowBack[0]?.displayName || peopleYouDontFollowBack[0]?.username || "Someone"}${
                      peopleYouDontFollowBack.length > 1
                        ? ` + ${peopleYouDontFollowBack.length - 1} others`
                        : ""
                    }`
                  : "No requests"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
        </button>

        {isLoading ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="px-3 py-6 text-sm text-red-600">
            {(error as Error)?.message || "Failed to load notifications."}
          </div>
        ) : notifications.length === 0 && peopleYouDontFollowBack.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          <>
            {last30Days.length ? (
              <Section title="Last 30 days">
                {last30Days.map((item) => {
                  const showFollowBack = item.kind === "follow" && item.canFollowBack;
                  const followLabel = item.isFollowingBack ? "Following" : "Follow back";
                  return (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onDismiss={() => dismiss(item.id)}
                      onOpen={() => openNotification(item)}
                      onFollowBack={showFollowBack ? () => handleFollowBack(item) : undefined}
                      followBackState={
                        showFollowBack
                          ? {
                              label:
                                toggleFollow.isPending &&
                                toggleFollow.variables?.targetUserId === item.actor.id
                                  ? "…"
                                  : followLabel,
                              disabled: toggleFollow.isPending,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </Section>
            ) : null}

            {older.length ? (
              <Section title="Older">
                {older.map((item) => {
                  const showFollowBack = item.kind === "follow" && item.canFollowBack;
                  const followLabel = item.isFollowingBack ? "Following" : "Follow back";
                  return (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onDismiss={() => dismiss(item.id)}
                      onOpen={() => openNotification(item)}
                      onFollowBack={showFollowBack ? () => handleFollowBack(item) : undefined}
                      followBackState={
                        showFollowBack
                          ? {
                              label:
                                toggleFollow.isPending &&
                                toggleFollow.variables?.targetUserId === item.actor.id
                                  ? "…"
                                  : followLabel,
                              disabled: toggleFollow.isPending,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </Section>
            ) : null}

            {peopleYouDontFollowBack.length ? (
              <Section title="People you don't follow back">
                {peopleYouDontFollowBack.slice(0, 10).map((actor) => {
                  const id = `dont-follow-back:${actor.id}`;
                  if (dismissed.has(id)) return null;
                  return (
                    <div key={actor.id} className={cn("flex items-center gap-3 row-pad")}>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => actor.username && navigate(`/u/${actor.username}`)}
                      >
                        <ActorAvatar actor={actor} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 truncate text-sm font-semibold">
                            <span className="truncate">{actor.displayName || actor.username || "User"}</span>
                            {actor.isVerified ? (
                              <VerifiedBadge
                                isVerified={actor.isVerified ?? null}
                                type={(actor.verifiedType as any) ?? null}
                                label={actor.verifiedLabel ?? null}
                                verifiedAt={actor.verifiedAt ?? null}
                                org={actor.verifiedByOrg ?? null}
                              />
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            Followed by{" "}
                            {actor.username ? `@${actor.username.replace(/^@/, "")}` : "someone"}
                          </div>
                        </div>
                      </button>

                      <Button
                        size="sm"
                        className="h-9 rounded-full px-4"
                        onClick={() =>
                          toggleFollow.mutate({ targetUserId: actor.id, currentlyFollowing: false })
                        }
                        disabled={toggleFollow.isPending}
                      >
                        Follow back
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => dismiss(id)}
                        aria-label="Dismiss"
                        className="icon-hit"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  );
                })}
              </Section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
