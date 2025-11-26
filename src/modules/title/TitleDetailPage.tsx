import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="max-w-md text-center text-sm text-mn-text-secondary">
          No title specified. Try opening this page from search, your diary, or the home feed.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-sm text-mn-text-secondary">Loading title…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center text-sm text-mn-text-secondary">
          <p>We couldn&apos;t find that title.</p>
          <Link to="/search" className="mt-2 inline-block text-mn-primary underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const metaPieces: string[] = [];
  if (data.year) metaPieces.push(String(data.year));
  if (data.type) metaPieces.push(data.type);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col gap-4 px-4 py-6">
      {data.backdrop_url && (
        <div className="relative mb-2 overflow-hidden rounded-3xl border border-mn-border-subtle bg-mn-surface-elevated">
          <img
            src={data.backdrop_url}
            alt={data.title ?? "Backdrop"}
            className="h-48 w-full object-cover sm:h-56 md:h-64"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-mn-bg/90 via-mn-bg/30 to-transparent" />
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-28 flex-shrink-0 sm:w-32 md:w-40">
          {data.poster_url ? (
            <img
              src={data.poster_url}
              alt={data.title ?? "Poster"}
              className="aspect-[2/3] w-full rounded-mn-card object-cover shadow-mn-card"
            />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center rounded-mn-card border border-dashed border-mn-border-subtle bg-mn-surface-elevated text-xs text-mn-text-muted">
              No poster available
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <div>
            <h1 className="text-xl font-heading font-semibold text-mn-text-primary sm:text-2xl">
              {data.title ?? "Untitled"}
            </h1>
            {metaPieces.length > 0 && (
              <p className="mt-1 text-sm text-mn-text-secondary">{metaPieces.join(" · ")}</p>
            )}
          </div>

          {trailerQuery.isLoading && (
            <p className="text-xs text-mn-text-secondary">Loading trailer…</p>
          )}

          {trailer && trailer.videoId && (
            <div className="mt-3 aspect-video w-full max-w-2xl">
              <iframe
                className="h-full w-full rounded-2xl"
                src={`https://www.youtube.com/embed/${trailer.videoId}`}
                title={`${data.title ?? "Trailer"}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          <p className="text-xs text-mn-text-muted">
            This is the early version of the title page. Over time it will show your rating, diary
            entry, where to watch, and what your friends think about it.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TitleDetailPage;
