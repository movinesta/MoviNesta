import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { LoadingScreen } from "@/components/ui/loading-screen";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { supabase } from "@/lib/supabase";
import { tmdbImageUrl } from "@/lib/tmdb";

import {
  fetchMediaSwipeDeck,
  getOrCreateMediaSwipeSessionId,
  sendOnboardingInitialLikes,
  type MediaSwipeCard,
} from "@/modules/swipe/mediaSwipeApi";
import { useSearchTitles, type TitleSearchResult } from "@/modules/search/useSearchTitles";

type Pick = {
  id: string;
  title: string;
  posterUrl: string | null;
};

function toPickFromSwipeCard(card: MediaSwipeCard): Pick {
  const poster =
    card.posterUrl ?? (card.tmdbPosterPath ? tmdbImageUrl(card.tmdbPosterPath, "w342") : null);

  return {
    id: card.mediaItemId,
    title: card.title ?? "Untitled",
    posterUrl: poster,
  };
}

function toPickFromSearchResult(item: TitleSearchResult): Pick {
  return {
    id: item.id,
    title: item.title,
    posterUrl: item.posterUrl ?? null,
  };
}

const MIN_PICKS = 5;

const GENRE_PRESETS = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
];

const TasteOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const sessionId = useMemo(() => getOrCreateMediaSwipeSessionId(), []);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const [popular, setPopular] = useState<Pick[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularError, setPopularError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<string, Pick>>({});
  const selectedCount = Object.keys(selected).length;

  const [selectedGenres, setSelectedGenres] = useState<Record<string, true>>({});
  const selectedGenreList = useMemo(() => Object.keys(selectedGenres), [selectedGenres]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const search = useSearchTitles({ query: debouncedQuery, filters: { type: "all" } });

  const results: TitleSearchResult[] = useMemo(() => {
    const pages = search.data?.pages ?? [];
    return pages.flatMap((p) => p.results ?? []);
  }, [search.data]);

  const toggleGenre = useCallback((genre: string) => {
    const g = String(genre).trim();
    if (!g) return;
    setSelectedGenres((prev) => {
      const next = { ...prev };
      if (next[g]) {
        delete next[g];
        return next;
      }
      // Keep this optional and small for signal-to-noise.
      if (Object.keys(next).length >= 6) return next;
      return { ...next, [g]: true };
    });
  }, []);

  const togglePick = useCallback((pick: Pick) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[pick.id]) {
        delete next[pick.id];
        return next;
      }
      return { ...next, [pick.id]: pick };
    });
  }, []);

  const removePick = useCallback((id: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const markOnboardedAndGo = useCallback(async () => {
    try {
      await supabase.auth.updateUser({ data: { onboarded: true } });
    } catch {
      // best-effort; even if this fails, the taste vectors were written
    }
    navigate("/swipe", { replace: true });
  }, [navigate]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const mediaItemIds = Object.keys(selected);
      const resp = await sendOnboardingInitialLikes(
        { sessionId, mediaItemIds, preferredGenres: selectedGenreList },
        { timeoutMs: 45000 },
      );

      if (!resp.ok) {
        throw new Error(resp.message ?? "Onboarding failed");
      }

      await markOnboardedAndGo();
    } catch (err) {
      console.error(err);
      setSubmitError((err as Error)?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }, [markOnboardedAndGo, selected, selectedGenreList, sessionId]);

  // Load "popular picks" from the trending deck
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setPopularLoading(true);
      setPopularError(null);
      try {
        const resp = await fetchMediaSwipeDeck(
          {
            sessionId,
            mode: "trending",
            limit: 24,
            seed: `onb:${new Date().toISOString().slice(0, 10)}`,
          },
          { timeoutMs: 30000 },
        );

        if (cancelled) return;
        const cards = (resp.cards ?? []) as MediaSwipeCard[];
        setPopular(cards.map(toPickFromSwipeCard));
      } catch (err) {
        console.error(err);
        if (!cancelled) setPopularError("Couldn’t load suggestions. You can still search below.");
      } finally {
        if (!cancelled) setPopularLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (submitting) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="type-heading text-foreground">Pick a few titles you like</h1>
        <p className="type-body text-muted-foreground">
          Choose at least {MIN_PICKS}. This helps MoviNesta personalize your “For you” deck
          immediately.
        </p>
      </div>

      {submitError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="type-caption text-muted-foreground">Selected:</span>
        {selectedCount === 0 ? (
          <span className="type-caption text-foreground">None yet</span>
        ) : (
          Object.values(selected)
            .slice(0, 12)
            .map((p) => (
              <Chip key={p.id} onClick={() => removePick(p.id)}>
                <span className="flex items-center gap-1">
                  <X className="h-3.5 w-3.5" />
                  {p.title}
                </span>
              </Chip>
            ))
        )}
        {selectedCount > 12 && (
          <span className="type-caption text-muted-foreground">+{selectedCount - 12} more</span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={submit}
          disabled={selectedCount < MIN_PICKS || submitting}
          className="rounded-2xl"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Continue
        </Button>

        <Button
          variant="ghost"
          onClick={markOnboardedAndGo}
          className="rounded-2xl"
          disabled={submitting}
        >
          Skip for now
        </Button>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="type-subheading text-foreground">Optional: pick genres you enjoy</h2>
          <p className="type-caption text-muted-foreground">
            This helps diversify your deck and improves cold-start recommendations.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {GENRE_PRESETS.map((g) => {
            const active = Boolean(selectedGenres[g]);
            return (
              <Chip
                key={g}
                onClick={() => toggleGenre(g)}
                className={active ? "border-foreground/30 bg-foreground/10" : undefined}
              >
                <span className="flex items-center gap-1">
                  {active ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {g}
                </span>
              </Chip>
            );
          })}
        </div>

        {selectedGenreList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-caption text-muted-foreground">Genres:</span>
            {selectedGenreList.map((g) => (
              <Chip key={g} onClick={() => toggleGenre(g)}>
                <span className="flex items-center gap-1">
                  <X className="h-3.5 w-3.5" />
                  {g}
                </span>
              </Chip>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="type-subheading text-foreground">Popular picks</h2>
          <span className="type-caption text-muted-foreground">
            Tap to {selectedCount ? "toggle" : "select"}
          </span>
        </div>

        {popularLoading ? (
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <span className="type-caption">Loading suggestions…</span>
          </div>
        ) : popularError ? (
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <span className="type-caption">{popularError}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {popular.map((p) => {
              const isSelected = !!selected[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePick(p)}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 text-left"
                >
                  {p.posterUrl ? (
                    <img
                      src={p.posterUrl}
                      alt={p.title}
                      className="h-44 w-full object-cover transition-transform group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center text-xs text-muted-foreground">
                      No poster
                    </div>
                  )}
                  <div className="p-2">
                    <div className="line-clamp-2 type-caption font-medium text-foreground">
                      {p.title}
                    </div>
                  </div>

                  <div className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-background/80 shadow">
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="type-subheading text-foreground">Search</h2>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies and series…"
            className="pl-9"
          />
        </div>

        {search.isLoading ? (
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-muted-foreground">
            <span className="type-caption">Searching…</span>
          </div>
        ) : debouncedQuery.trim().length > 0 && results.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-muted-foreground">
            <span className="type-caption">No results.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {results.slice(0, 20).map((r) => {
              const pick = toPickFromSearchResult(r);
              const isSelected = !!selected[pick.id];
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => togglePick(pick)}
                  className="soft-row-card soft-row-card-interactive flex w-full items-center gap-3 row-pad text-left"
                >
                  {pick.posterUrl ? (
                    <img
                      src={pick.posterUrl}
                      alt={pick.title}
                      className="h-16 w-12 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-16 w-12 items-center justify-center rounded-xl bg-background/60 text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate type-label text-foreground">{pick.title}</div>
                    <div className="type-caption text-muted-foreground">
                      {r.type ?? "title"} {typeof r.year === "number" ? `• ${r.year}` : ""}
                    </div>
                  </div>

                  <div className="grid h-9 w-9 place-items-center rounded-full bg-background/80 shadow">
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </div>
                </button>
              );
            })}

            {search.hasNextPage && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  className="rounded-2xl"
                  disabled={search.isFetchingNextPage}
                  onClick={() => search.fetchNextPage()}
                >
                  {search.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default TasteOnboardingPage;
