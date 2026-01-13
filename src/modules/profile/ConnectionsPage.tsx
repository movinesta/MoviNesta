import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";
import { UserMinus, UserPlus } from "lucide-react";
import TopBar from "@/components/shared/TopBar";
import SearchField from "@/components/shared/SearchField";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useToggleFollow } from "@/modules/search/useToggleFollow";
import { useProfileByUsername } from "./useProfile";
import {
  formatHandle,
  useProfileConnections,
  type ConnectionMode,
  type ConnectionPerson,
} from "./useProfileConnections";

const getInitial = (displayName: string | null, username: string | null) => {
  const source = (displayName ?? username ?? "?").replace(/^@/, "").trim();
  return source ? source[0]?.toUpperCase() : "?";
};

function PersonRow({
  person,
  viewerId,
  onToggleFollow,
  isToggling,
}: {
  person: ConnectionPerson;
  viewerId: string | null;
  onToggleFollow: (id: string, currentlyFollowing: boolean) => void;
  isToggling: boolean;
}) {
  const displayName = person.displayName ?? person.username ?? "Unknown user";
  const handle = formatHandle(person.username);
  const isSelf = Boolean(viewerId && viewerId === person.id);

  return (
    <div className="soft-row-card mx-2 my-1 flex min-h-11 items-center justify-between gap-3 row-pad">
      <Link
        to={person.username ? `/u/${person.username}` : `/u/${person.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-card/80 text-[14px] font-semibold text-foreground">
          {person.avatarUrl ? (
            <img
              src={person.avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span>{getInitial(person.displayName, person.username)}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            {isSelf && (
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                You
              </span>
            )}
          </div>
          {handle && <p className="mt-0.5 text-xs text-muted-foreground">{handle}</p>}
          {person.bio && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{person.bio}</p>
          )}
        </div>
      </Link>

      {!isSelf && (
        <Button
          type="button"
          size="sm"
          variant={person.isFollowing ? "outline" : "default"}
          className="h-10 rounded-full px-3 text-xs"
          onClick={() => onToggleFollow(person.id, person.isFollowing)}
          disabled={isToggling}
        >
          {isToggling ? (
            <span>…</span>
          ) : person.isFollowing ? (
            <>
              <UserMinus className="h-3 w-3" aria-hidden="true" />
              <span>Following</span>
            </>
          ) : (
            <>
              <UserPlus className="h-3 w-3" aria-hidden="true" />
              <span>Follow</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}

const ConnectionsPage: React.FC<{ mode: ConnectionMode }> = ({ mode }) => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toggleFollow = useToggleFollow();

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useProfileByUsername(username ?? "");

  const connections = useProfileConnections(profile?.id ?? null, mode);

  const [query, setQuery] = React.useState("");
  const flat = React.useMemo(
    () => (connections.data?.pages ?? []).flatMap((page) => page.items),
    [connections.data?.pages],
  );

  const filtered = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return flat;
    return flat.filter((person) => {
      const hay = [person.displayName, person.username, formatHandle(person.username), person.bio]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(trimmed);
    });
  }, [flat, query]);

  const title = mode === "followers" ? "Followers" : "Following";

  const handleToggleFollow = (id: string, currentlyFollowing: boolean) => {
    toggleFollow.mutate({ targetUserId: id, currentlyFollowing });
  };

  const isBusyFor = toggleFollow.isPending ? toggleFollow.variables?.targetUserId : null;

  const canFetchMore = Boolean(connections.hasNextPage && !connections.isFetchingNextPage);

  const endReached = () => {
    if (!canFetchMore) return;
    // Avoid confusing UX while searching locally.
    if (query.trim()) return;
    connections.fetchNextPage();
  };

  if (isProfileLoading) {
    return (
      <div className="flex flex-1 flex-col gap-[var(--section-gap)] pb-[var(--page-pad-y)]">
        <TopBar title={title} onBack={() => navigate(-1)} />
        <div className="px-3 text-xs text-muted-foreground">Loading connections…</div>
      </div>
    );
  }

  if (isProfileError || !profile) {
    return (
      <div className="flex flex-1 flex-col gap-[var(--section-gap)] pb-[var(--page-pad-y)]">
        <TopBar title={title} onBack={() => navigate(-1)} />
        <div className="px-3 text-xs text-muted-foreground">
          We couldn&apos;t load this profile.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-[var(--section-gap)] pb-[var(--page-pad-y)]">
      <TopBar title={title} onBack={() => navigate(-1)} />

      <div className="page-pad">
        <SearchField
          placeholder={`Search ${title.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 page-pad">
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/40">
          {connections.isLoading ? (
            <div className="p-[var(--card-pad)] text-xs text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-[var(--card-pad)] text-xs text-muted-foreground">
              {query.trim()
                ? `No ${title.toLowerCase()} match “${query.trim()}”.`
                : mode === "followers"
                  ? "No followers yet."
                  : "Not following anyone yet."}
            </div>
          ) : (
            <Virtuoso
              style={{ height: "100%" }}
              data={filtered}
              endReached={endReached}
              itemContent={(_, person) => (
                <PersonRow
                  person={person}
                  viewerId={user?.id ?? null}
                  isToggling={Boolean(isBusyFor && isBusyFor === person.id)}
                  onToggleFollow={handleToggleFollow}
                />
              )}
              components={{
                Footer: () =>
                  connections.isFetchingNextPage ? (
                    <div className="p-[var(--card-pad)] text-center text-xs text-muted-foreground">
                      Loading more…
                    </div>
                  ) : connections.hasNextPage ? (
                    <div className="p-[var(--card-pad)] text-center text-xs text-muted-foreground">
                      Scroll for more
                    </div>
                  ) : (
                    <div className="p-[var(--card-pad)] text-center text-xs text-muted-foreground">
                      End
                    </div>
                  ),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionsPage;
