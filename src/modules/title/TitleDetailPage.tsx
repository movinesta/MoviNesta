import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";
import { useSimilarTitles } from "./useSimilarTitles";
import { supabase } from "../../lib/supabase";

interface ExternalRatingsRow {
  imdb_rating: number | null;
  rt_tomato_meter: number | null;
  metacritic_score: number | null;
}

interface TitleRow {
  id: string;
  title: string | null;
  year: number | null;
  type: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  external_ratings: ExternalRatingsRow | null;
}

function useTrailerForTitle(title?: string | null, year?: number | null) {
  return useQuery({
    queryKey: ["trailer", title, year],
    enabled: !!title,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        videoId: string | null;
        url: string | null;
        query: string;
      }>("fetch-trailer", {
        method: "POST",
        body: {
          title,
          year,
        },
      });

      if (error) {
        console.warn("[TitleDetailPage] trailer fetch error:", error);
        return null;
      }

      return data ?? null;
    },
    staleTime: 1000 * 60 * 60, // cache for 1 hour
  });
}

type ExternalRatingsProps = {
  external_ratings: ExternalRatingsRow | null;
};

const ExternalRatingsChips: React.FC<ExternalRatingsProps> = ({ external_ratings }) => {
  if (!external_ratings) return null;

  const { imdb_rating, rt_tomato_meter, metacritic_score } = external_ratings;

  const hasImdbRating =
    typeof imdb_rating === "number" && !Number.isNaN(imdb_rating) && imdb_rating > 0;
  const hasTomatometer =
    typeof rt_tomato_meter === "number" && !Number.isNaN(rt_tomato_meter) && rt_tomato_meter > 0;
  const hasMetacriticScore =
    typeof metacritic_score === "number" && !Number.isNaN(metacritic_score) && metacritic_score > 0;

  if (!hasImdbRating && !hasTomatometer && !hasMetacriticScore) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-mn-text-muted">
      {hasImdbRating && (
        <span className="inline-flex items-center rounded-full border border-mn-border-subtle px-2 py-0.5">
          <span className="mr-1 font-semibold">IMDb Rating</span>
          {imdb_rating.toFixed(1)}
        </span>
      )}

      {hasTomatometer && (
        <span className="inline-flex items-center rounded-full border border-mn-border-subtle px-2 py-0.5">
          <span className="mr-1 font-semibold">Tomatometer</span>
          {rt_tomato_meter}%
        </span>
      )}

      {hasMetacriticScore && (
        <span className="inline-flex items-center rounded-full border border-mn-border-subtle px-2 py-0.5">
          <span className="mr-1 font-semibold">MC</span>
          {metacritic_score}
        </span>
      )}
    </div>
  );
};

const TitleDetailPage: React.FC = () => {
  const { titleId } = useParams<{ titleId: string }>();

  const { data, isLoading, isError } = useQuery<TitleRow | null, Error>({
    queryKey: ["title-detail", titleId],
    enabled: Boolean(titleId),
    queryFn: async () => {
      if (!titleId) return null;

      const { data, error } = await supabase
        .from("titles")
        .select(
          `
          id,
          title,
          year,
          type,
          poster_url,
          backdrop_url,
          external_ratings (
            imdb_rating,
            rt_tomato_meter,
            metacritic_score
          )
        `,
        )
        .eq("id", titleId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as TitleRow | null;
    },
  });

  const trailerQuery = useTrailerForTitle(data?.title ?? null, data?.year ?? null);
  const trailer = trailerQuery.data;
  const similarQuery = useSimilarTitles(titleId ?? null);

  if (!titleId) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
        <TopBar
          title="Title details"
          subtitle="Pick something from search, your diary, or the feed to see its details."
        />

        <PageSection>
          <p className="text-sm text-mn-text-secondary">
            No title was specified for this page. Try opening it from search, your diary, or the{" "}
            home feed.
          </p>
        </PageSection>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
        <TopBar title="Loading title" />
        <PageSection>
          <p className="text-sm text-mn-text-secondary">Fetching title details…</p>
        </PageSection>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
        <TopBar title="Title not found" />
        <PageSection>
          <p className="text-sm text-mn-text-secondary">We couldn&apos;t find that title.</p>
          <Link to="/search" className="mt-3 inline-block text-sm text-mn-primary underline">
            Back to search
          </Link>
        </PageSection>
      </div>
    );
  }

  const metaPieces: string[] = [];
  if (data.year) metaPieces.push(String(data.year));
  if (data.type) metaPieces.push(data.type);

  const posterImage = data.poster_url ?? data.backdrop_url;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
      {data.backdrop_url && (
        <div className="relative overflow-hidden rounded-3xl border border-mn-border-subtle bg-mn-bg-elevated/80 shadow-mn-soft">
          <img
            src={data.backdrop_url}
            alt={data.title ?? "Backdrop"}
            className="h-48 w-full object-cover sm:h-56 md:h-64"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-mn-bg/90 via-mn-bg/30 to-transparent" />
        </div>
      )}

      <TopBar
        title={data.title ?? "Untitled"}
        subtitle={metaPieces.length > 0 ? metaPieces.join(" · ") : "Title details"}
      />

      <ExternalRatingsChips external_ratings={data.external_ratings} />

      <PageSection>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-28 flex-shrink-0 sm:w-32 md:w-40">
            {posterImage ? (
              <img
                src={posterImage}
                alt={data.title ?? "Poster"}
                className="aspect-[2/3] w-full rounded-mn-card object-cover shadow-mn-card"
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-mn-card border border-dashed border-mn-border-subtle bg-mn-bg/70 text-xs text-mn-text-muted">
                No poster available
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3">
            {trailerQuery.isLoading && (
              <p className="text-xs text-mn-text-secondary">Loading trailer…</p>
            )}

            {trailer && trailer.videoId && (
              <div className="mt-1 space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-mn-primary/10 px-2.5 py-1 text-[11px] font-medium text-mn-primary">
                  <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Official trailer</span>
                </div>
                <div className="aspect-video w-full max-w-2xl">
                  <iframe
                    className="h-full w-full rounded-2xl"
                    src={`https://www.youtube.com/embed/${trailer.videoId}`}
                    title={`${data.title ?? "Trailer"}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-dashed border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-3 text-[12px] text-mn-text-secondary">
              <p className="font-semibold text-mn-text-primary">More coming soon</p>
              <p className="mt-1 text-[11.5px] text-mn-text-muted">
                This early version will grow to show where to watch, your diary entry, ratings, and
                friends&apos; reactions.
              </p>
            </div>

            {similarQuery.data && similarQuery.data.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-heading font-semibold text-mn-text-primary">
                  Similar titles
                </h3>
                <div className="-mx-1 overflow-x-auto pb-1">
                  <div className="flex snap-x snap-mandatory gap-2 px-1">
                    {similarQuery.data.map((item) => (
                      <Link
                        key={item.id}
                        to={`/title/${item.id}`}
                        className="group flex w-[140px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-mn-border-subtle/80 bg-mn-bg-elevated/80 shadow-mn-soft"
                      >
                        <div className="relative h-32 overflow-hidden">
                          {item.posterUrl ? (
                            <img
                              src={item.posterUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-mn-bg-subtle text-[10px] text-mn-text-muted">
                              No poster
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col justify-between px-2.5 py-2">
                          <div className="space-y-0.5">
                            <p className="line-clamp-2 text-[12px] font-semibold text-mn-text-primary">
                              {item.title}
                            </p>
                            <p className="text-[10px] text-mn-text-muted">
                              {[item.year, item.type].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-mn-primary group-hover:underline">
                            <span>Open</span>
                            <PlayCircle className="h-3 w-3" aria-hidden="true" />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageSection>
    </div>
  );
};

export default TitleDetailPage;
