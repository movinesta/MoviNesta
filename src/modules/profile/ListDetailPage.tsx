import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Share2 } from "lucide-react";
import { useListDetail } from "./useListDetail";
import TopBar from "@/components/shared/TopBar";

const safeShare = async (title: string) => {
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
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
    <div className="flex flex-1 flex-col pb-2">
      <TopBar
        title={list?.name ?? "List"}
        actions={[
          {
            icon: Share2,
            label: "Share",
            onClick: () => safeShare(list?.name ?? "List"),
          },
        ]}
      />

      {isLoading && <div className="page-pad-all text-xs text-muted-foreground">Loading list…</div>}

      {isError && (
        <div className="page-pad-all">
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 card-pad text-xs text-foreground shadow-sm">
            <p className="font-semibold">Unable to load this list.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error?.message ?? "Please try again in a moment."}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isError && list && (
        <div className="page-pad-all">
          {list.description && (
            <p className="mb-3 text-xs text-muted-foreground">{list.description}</p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {list.items.map((item) => (
              <button
                key={item.titleId}
                type="button"
                aria-label={`Open ${(item.title ?? "title")}`}
                className="group relative overflow-hidden rounded-xl border border-border bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-2 pb-1 pt-6 opacity-0 transition group-hover:opacity-100">
                  <p className="line-clamp-1 text-left text-[10px] font-semibold text-foreground">
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
