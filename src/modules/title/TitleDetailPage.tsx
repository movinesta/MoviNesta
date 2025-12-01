import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";
import { supabase } from "../../lib/supabase";

interface TitleRow {
  id: string;
  primary_title: string | null;
  original_title: string | null;
  release_year: number | null;
  content_type: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  imdb_rating: number | null;
  omdb_rt_rating_pct: number | null;
  metascore: number | null;
}

type RatingsProps = {
  imdb_rating: number | null;
  omdb_rt_rating_pct: number | null;
  metascore: number | null;
};

const ExternalRatingsChips: React.FC<RatingsProps> = ({
  imdb_rating,
  omdb_rt_rating_pct,
  metascore,
}) => {
  const hasAnyRating =
    (typeof imdb_rating === "number" && imdb_rating > 0) ||
    (typeof omdb_rt_rating_pct === "number" && omdb_rt_rating_pct > 0) ||
    (typeof metascore === "number" && metascore > 0);

  if (!hasAnyRating) return null;

  const hasImdbRating =
    typeof imdb_rating === "number" && !Number.isNaN(imdb_rating) && imdb_rating > 0;
  const hasTomatometer =
    typeof omdb_rt_rating_pct === "number" &&
    !Number.isNaN(omdb_rt_rating_pct) &&
    omdb_rt_rating_pct > 0;
  const hasMetacriticScore =
    typeof metascore === "number" && !Number.isNaN(metascore) && metascore > 0;

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
          {omdb_rt_rating_pct}%
        </span>
      )}

      {hasMetacriticScore && (
        <span className="inline-flex items-center rounded-full border border-mn-border-subtle px-2 py-0.5">
          <span className="mr-1 font-semibold">MC</span>
          {metascore}
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
          id:title_id,
          primary_title,
          original_title,
          release_year,
          content_type,
          poster_url,
          backdrop_url,
          imdb_rating,
          omdb_rt_rating_pct,
          metascore
        `,
        )
        .eq("title_id", titleId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as TitleRow | null;
    },
  });

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

  const displayTitle = data.primary_title ?? data.original_title ?? "Untitled";
  const metaPieces: string[] = [];
  if (data.release_year) metaPieces.push(String(data.release_year));
  if (data.content_type) metaPieces.push(data.content_type);

  const posterImage = data.poster_url ?? data.backdrop_url;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
      {data.backdrop_url && (
        <div className="relative overflow-hidden rounded-3xl border border-mn-border-subtle bg-mn-bg-elevated/80 shadow-mn-soft">
          <img
            src={data.backdrop_url}
            alt={displayTitle}
            className="h-48 w-full object-cover sm:h-56 md:h-64"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-mn-bg/90 via-mn-bg/30 to-transparent" />
        </div>
      )}

      <TopBar
        title={displayTitle}
        subtitle={metaPieces.length > 0 ? metaPieces.join(" · ") : "Title details"}
      />

      <ExternalRatingsChips
        imdb_rating={data.imdb_rating}
        omdb_rt_rating_pct={data.omdb_rt_rating_pct}
        metascore={data.metascore}
      />

      <PageSection>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-28 flex-shrink-0 sm:w-32 md:w-40">
            {posterImage ? (
              <img
                src={posterImage}
                alt={displayTitle}
                className="aspect-[2/3] w-full rounded-mn-card object-cover shadow-mn-card"
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-mn-card border border-dashed border-mn-border-subtle bg-mn-bg/70 text-xs text-mn-text-muted">
                No poster available
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div className="rounded-2xl border border-dashed border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-3 text-[12px] text-mn-text-secondary">
              <p className="font-semibold text-mn-text-primary">More coming soon</p>
              <p className="mt-1 text-[11.5px] text-mn-text-muted">
                This early version will grow to show where to watch, your diary entry, ratings, and
                friends&apos; reactions.
              </p>
            </div>
          </div>
        </div>
      </PageSection>
    </div>
  );
};

export default TitleDetailPage;
