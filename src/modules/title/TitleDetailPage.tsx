import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, PlayCircle } from "lucide-react";
import { PageHeader, PageSection } from "../../components/PageChrome";
import { supabase } from "../../lib/supabase";

interface TitleRow {
  id: string;
  title: string | null;
  year: number | null;
  type: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
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

const TitleDetailPage: React.FC = () => {
  const { titleId } = useParams<{ titleId: string }>();

  const { data, isLoading, isError } = useQuery<TitleRow | null, Error>({
    queryKey: ["title-detail", titleId],
    enabled: Boolean(titleId),
    queryFn: async () => {
      if (!titleId) return null;

      const { data, error } = await supabase
        .from("titles")
        .select("id, title, year, type, poster_url, backdrop_url")
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

  if (!titleId) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
        <PageHeader
          title="Title details"
          description="Pick something from search, your diary, or the feed to see its details."
          icon={Clapperboard}
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
        <PageHeader title="Loading title" icon={Clapperboard} />
        <PageSection>
          <p className="text-sm text-mn-text-secondary">Fetching title details…</p>
        </PageSection>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
        <PageHeader title="Title not found" icon={Clapperboard} />
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

      <PageHeader
        title={data.title ?? "Untitled"}
        description={metaPieces.length > 0 ? metaPieces.join(" · ") : "Title details"}
        icon={Clapperboard}
        badge={data.type ?? undefined}
      />

      <PageSection>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-28 flex-shrink-0 sm:w-32 md:w-40">
            {data.poster_url ? (
              <img
                src={data.poster_url}
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
          </div>
        </div>
      </PageSection>
    </div>
  );
};

export default TitleDetailPage;
