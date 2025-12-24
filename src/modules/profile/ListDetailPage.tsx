import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useListDetail } from "./useListDetail";

const safeShare = async (title: string) => {
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      // @ts-expect-error - share exists in browsers that support it
      await navigator.share({ title });
      return;
    }
  } catch {
    // fall back
  }
  try {
    await navigator.clipboard.writeText(window.location.href);
  } catch {
    // ignore
  }
};

const ListDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { listId } = useParams();
  const { data: list, isLoading, isError, error } = useListDetail(listId);

  return (
    <div className="flex flex-1 flex-col pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">{list?.name ?? "List"}</h1>
            <p className="truncate text-xs text-muted-foreground">{list?.items.length ?? 0} titles</p>
          </div>
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => safeShare(list?.name ?? "List")}
          aria-label="Share"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      {isLoading && (
        <div className="px-4 py-6 text-xs text-muted-foreground">Loading list…</div>
      )}

      {isError && (
        <div className="px-4 py-6">
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-xs text-foreground shadow-lg">
            <p className="font-semibold">Unable to load this list.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error?.message ?? "Please try again in a moment."}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isError && list && (
        <div className="px-3 py-4">
          {list.description && (
            <p className="mb-3 text-xs text-muted-foreground">{list.description}</p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {list.items.map((item) => (
              <button
                key={item.titleId}
                type="button"
                className="group relative overflow-hidden rounded-xl border border-border bg-muted/30"
                onClick={() => navigate(`/title/${item.titleId}`)}
              >
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.title ?? "Title"}
                    className="aspect-[2/3] w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-[2/3] w-full bg-muted" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-6 opacity-0 transition group-hover:opacity-100">
                  <p className="line-clamp-1 text-left text-[10px] font-semibold text-white">
                    {item.title ?? "Untitled"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ListDetailPage;
