import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";

export interface ProfileHighlight {
  id: string;
  name: string;
  isPublic: boolean;
  coverPosterUrl: string | null;
}

type ListRow = {
  id: string;
  name: string;
  is_public: boolean;
  updated_at: string | null;
  created_at: string;
};

type ListItemRow = {
  list_id: string;
  title_id: string;
  position: number | null;
  created_at: string;
};

export const useProfileHighlights = (profileId: string | null | undefined, isOwner: boolean) => {
  return useQuery<ProfileHighlight[]>({
    queryKey: ["profile", "highlights", profileId, isOwner],
    enabled: Boolean(profileId),
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (!profileId) return [];

      let listQuery = supabase
        .from("lists" as any)
        .select("id, name, is_public, updated_at, created_at")
        .eq("user_id", profileId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);

      if (!isOwner) {
        listQuery = listQuery.eq("is_public", true);
      }

      const { data: lists, error: listsError } = await listQuery;

      if (listsError) {
        throw new Error(listsError.message);
      }

      const listRows = (lists as any as ListRow[]) ?? [];
      if (!listRows.length) return [];

      const listIds = listRows.map((l) => l.id);

      const { data: items, error: itemsError } = await supabase
        .from("list_items" as any)
        .select("list_id, title_id, position, created_at")
        .in("list_id", listIds)
        .order("position", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true })
        .limit(240);

      if (itemsError) {
        console.warn("[useProfileHighlights] Failed to load list_items", itemsError.message);
      }

      const coverByListId = new Map<string, string>();

      for (const row of ((items as any as ListItemRow[]) ?? [])) {
        if (!row?.list_id || !row?.title_id) continue;
        if (!coverByListId.has(row.list_id)) {
          coverByListId.set(row.list_id, row.title_id);
        }
      }

      const coverTitleIds = Array.from(new Set(Array.from(coverByListId.values())));
      const posterByTitleId = new Map<string, string | null>();

      if (coverTitleIds.length) {
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
          .in("id", coverTitleIds);

        if (titlesError) {
          console.warn("[useProfileHighlights] Failed to load media_items", titlesError.message);
        } else {
          for (const row of (titles as MediaItemRow[]) ?? []) {
            const summary = mapMediaItemToSummary(row);
            posterByTitleId.set(row.id, summary.posterUrl ?? summary.backdropUrl ?? null);
          }
        }
      }

      return listRows.map((list) => {
        const coverTitleId = coverByListId.get(list.id) ?? null;
        const coverPosterUrl = coverTitleId ? posterByTitleId.get(coverTitleId) ?? null : null;
        return {
          id: list.id,
          name: list.name,
          isPublic: Boolean(list.is_public),
          coverPosterUrl,
        } satisfies ProfileHighlight;
      });
    },
  });
};
