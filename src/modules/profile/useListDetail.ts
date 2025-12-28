import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";

export interface ListDetailItem {
  titleId: string;
  title: string | null;
  year: number | null;
  posterUrl: string | null;
}

export interface ListDetail {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  items: ListDetailItem[];
}

type ListRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
};

type ListItemRow = {
  title_id: string;
  position: number | null;
  created_at: string;
};

export const useListDetail = (listId: string | null | undefined) => {
  return useQuery<ListDetail | null>({
    queryKey: ["lists", "detail", listId],
    enabled: Boolean(listId),
    queryFn: async () => {
      if (!listId) return null;

      const { data: list, error: listError } = await supabase
        .from("lists" as any)
        .select("id, user_id, name, description, is_public")
        .eq("id", listId)
        .maybeSingle();

      if (listError) throw new Error(listError.message);
      if (!list) return null;

      const { data: items, error: itemsError } = await supabase
        .from("list_items" as any)
        .select("title_id, position, created_at")
        .eq("list_id", listId)
        .order("position", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true })
        .limit(300);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      const itemRows = (items as any as ListItemRow[]) ?? [];
      const titleIds = Array.from(
        new Set(itemRows.map((r) => r.title_id).filter((id): id is string => Boolean(id))),
      );

      const titlesById = new Map<string, ListDetailItem>();

      if (titleIds.length) {
        const { data: titles, error: titlesError } = await supabase
          .from("media_items")
          .select(
            `id,
             kind,
             tmdb_title,
             tmdb_name,
             tmdb_original_title,
             tmdb_original_name,
             tmdb_release_date,
             tmdb_first_air_date,
             tmdb_poster_path,
             tmdb_backdrop_path,
             tmdb_original_language,
             omdb_title,
             omdb_year,
             omdb_language,
             omdb_imdb_id,
             omdb_imdb_rating,
             omdb_rating_rotten_tomatoes,
             omdb_poster,
             omdb_rated,
             tmdb_id`,
          )
          .in("id", titleIds);

        if (!titlesError && titles) {
          for (const row of titles as MediaItemRow[]) {
            const summary = mapMediaItemToSummary(row);
            titlesById.set(row.id, {
              titleId: row.id,
              title: summary.title ?? null,
              year: summary.year ?? null,
              posterUrl: summary.posterUrl ?? summary.backdropUrl ?? null,
            });
          }
        } else if (titlesError) {
          console.warn("[useListDetail] Failed to load titles", titlesError.message);
        }
      }

      const resolvedItems = itemRows
        .map(
          (row) =>
            titlesById.get(row.title_id) ?? {
              titleId: row.title_id,
              title: null,
              year: null,
              posterUrl: null,
            },
        )
        .filter((i) => Boolean(i.titleId));

      return {
        id: (list as any as ListRow).id,
        userId: (list as any as ListRow).user_id,
        name: (list as any as ListRow).name,
        description: (list as any as ListRow).description ?? null,
        isPublic: Boolean((list as any as ListRow).is_public),
        items: resolvedItems,
      } satisfies ListDetail;
    },
  });
};
