import React from "react";
import { Chip } from "@/components/ui/Chip";

type RatingsProps = {
  imdb_rating: number | null;
  rt_tomato_pct: number | null;
  metascore: number | null;
};

export const ExternalRatingsChips: React.FC<RatingsProps> = ({
  imdb_rating,
  rt_tomato_pct,
  metascore,
}) => {
  const hasAnyRating =
    (typeof imdb_rating === "number" && imdb_rating > 0) ||
    (typeof rt_tomato_pct === "number" && rt_tomato_pct > 0) ||
    (typeof metascore === "number" && metascore > 0);

  if (!hasAnyRating) return null;

  const hasImdbRating =
    typeof imdb_rating === "number" && !Number.isNaN(imdb_rating) && imdb_rating > 0;
  const hasTomatometer =
    typeof rt_tomato_pct === "number" && !Number.isNaN(rt_tomato_pct) && rt_tomato_pct > 0;
  const hasMetacriticScore =
    typeof metascore === "number" && !Number.isNaN(metascore) && metascore > 0;

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
      {hasImdbRating && (
        <Chip variant="outline" className="gap-1 px-2 py-0.5">
          <span className="font-semibold">IMDb</span>
          <span>{imdb_rating.toFixed(1)}</span>
        </Chip>
      )}

      {hasTomatometer && (
        <Chip variant="outline" className="gap-1 px-2 py-0.5">
          <span className="font-semibold">Tomatometer</span>
          <span>{rt_tomato_pct}%</span>
        </Chip>
      )}

      {hasMetacriticScore && (
        <Chip variant="outline" className="gap-1 px-2 py-0.5">
          <span className="font-semibold">MC</span>
          <span>{metascore}</span>
        </Chip>
      )}
    </div>
  );
};
