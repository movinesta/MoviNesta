import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export interface SimilarTitle {
  id: string;
  title: string;
  year: number | null;
  runtimeMinutes: number | null;
  type: string | null;
  posterUrl: string | null;
}

export function useSimilarTitles(titleId: string | null | undefined) {
  return useQuery<SimilarTitle[]>({
    queryKey: ["similar-titles", titleId],
    enabled: Boolean(titleId),
    queryFn: async () => {
      if (!titleId) return [];

      const { data, error } = await supabase.functions.invoke<{
        items?: {
          id: string;
          title: string;
          year: number | null;
          runtimeMinutes: number | null;
          type: string | null;
          posterUrl: string | null;
        }[];
      }>("similar-titles", {
        body: { titleId, limit: 16 },
      });

      if (error) {
        console.warn("[useSimilarTitles] edge function error:", error);
        return [];
      }

      const items = data?.items ?? [];
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        year: item.year ?? null,
        runtimeMinutes: item.runtimeMinutes ?? null,
        type: item.type ?? null,
        posterUrl: item.posterUrl ?? null,
      }));
    },
  });
}
