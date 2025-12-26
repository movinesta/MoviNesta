import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/modules/auth/AuthProvider";
import type { Database } from "@/types/supabase";

interface CreateHighlightArgs {
  name: string;
  autoFillTopMovies?: boolean;
}

type RatingRow = {
  title_id: string;
  content_type: Database["public"]["Enums"]["content_type"];
  rating: number;
  updated_at: string;
};

export const useCreateHighlight = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ listId: string }, Error, CreateHighlightArgs>({
    mutationFn: async ({ name, autoFillTopMovies = true }) => {
      if (!user?.id) throw new Error("You need to be signed in.");

      const cleanedName = name.trim();
      if (!cleanedName) throw new Error("Please enter a name.");

      const { data: list, error: listError } = await supabase
        .from("lists" as any)
        .insert({
          user_id: user.id,
          name: cleanedName,
          is_public: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (listError) throw new Error(listError.message);

      const listId = (list as any)?.id as string | undefined;
      if (!listId) throw new Error("Failed to create highlight.");

      if (autoFillTopMovies) {
        const { data: ratings, error: ratingsError } = await supabase
          .from("ratings" as any)
          .select("title_id, content_type, rating, updated_at")
          .eq("user_id", user.id)
          .order("rating", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(10);

        if (ratingsError) {
          console.warn("[useCreateHighlight] Failed to load ratings", ratingsError.message);
        } else {
          const rows = (ratings as any as RatingRow[]) ?? [];
          const items = rows
            .filter((r) => Boolean(r.title_id))
            .slice(0, 10)
            .map((r, idx) => ({
              list_id: listId,
              title_id: r.title_id,
              content_type: r.content_type,
              position: idx + 1,
              created_at: new Date().toISOString(),
            }));

          if (items.length) {
            const { error: itemsError } = await supabase.from("list_items" as any).insert(items);
            if (itemsError) {
              console.warn("[useCreateHighlight] Failed to insert list_items", itemsError.message);
            }
          }
        }
      }

      return { listId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "highlights"] });
      queryClient.invalidateQueries({ queryKey: ["diary", "timeline"] });
    },
  });
};
