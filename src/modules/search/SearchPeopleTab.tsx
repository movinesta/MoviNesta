import React from "react";
import { Loader2, Users } from "lucide-react";
import { useSearchPeople } from "./useSearchPeople";
import { PeopleResultRow, type PersonRowData } from "./PeopleResultRow";

interface SearchPeopleTabProps {
  query: string;
}

const SearchPeopleTab: React.FC<SearchPeopleTabProps> = ({ query }) => {
  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.replace(/^@+/, "");
  const effectiveQuery = normalizedQuery || trimmedQuery;

  if (normalizedQuery && normalizedQuery.length < 2) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-muted-foreground">
          Keep typing to search people — enter at least{" "}
          <span className="font-semibold text-foreground">2 characters</span>.
        </p>
        <p className="text-xs text-muted-foreground">
          Tip: You can type <span className="font-semibold text-foreground">@</span> to search usernames.
        </p>
      </div>
    );
  }

  const { data, isLoading, isFetching, isError, error } = useSearchPeople(normalizedQuery);

  const results = data ?? [];

  if (!normalizedQuery) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground">
          Start typing a name or @username to find people. Once the social graph is wired up,
          you&apos;ll be able to follow friends and start conversations from here.
        </p>
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>Search for people you know, then follow or message them.</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground">Searching for people…</p>
        <div className="rounded-2xl border border-border bg-card/80 px-3 py-4 text-xs text-muted-foreground">
          We&apos;ll show matching profiles here as soon as the results come back.
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-foreground">Something went wrong.</p>
        <p className="text-xs text-muted-foreground">
          {error?.message ?? "We couldn&apos;t search for people right now. Please try again."}
        </p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground">
          No people found for{" "}
          <span className="rounded border border-border bg-card px-1.5 py-0.5 text-xs font-medium text-foreground">
            &ldquo;{effectiveQuery}&rdquo;
          </span>
          . Try a different name or username.
        </p>
      </div>
    );
  }

  const rows: PersonRowData[] = results.map((person) => ({
    id: person.id,
    username: person.username,
    displayName: person.displayName,
    avatarUrl: person.avatarUrl,
    bio: person.bio,
    followersCount: person.followersCount ?? null,
    followingCount: person.followingCount ?? null,
    isFollowing: person.isFollowing,
    matchPercent: person.matchPercent ?? null,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing {results.length} profile{results.length === 1 ? "" : "s"} for{" "}
          <span className="rounded border border-border bg-card px-1.5 py-0.5 text-xs font-medium text-foreground">
            &ldquo;{effectiveQuery}&rdquo;
          </span>
        </p>
      </div>

      {isFetching ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Updating results…
        </div>
      ) : null}

      <div className="space-y-2">
        {rows.map((person) => (
          <PeopleResultRow
            key={person.id}
            person={person}
            variant="full"
            highlightQuery={normalizedQuery}
          />
        ))}
      </div>
    </div>
  );
};

export default SearchPeopleTab;
