import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/modules/auth/AuthProvider";
import { rating0_10ToStars } from "@/lib/ratings";
import type { DiaryStatus } from "@/modules/diary/useDiaryLibrary";

export type TitleDiarySummary = {
  status: DiaryStatus | null;
  /** Star rating (0.5–5) or null. */
  rating: number | null;
};

const isUuid = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value,
  );
};

const uniq = (items: string[]) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of items) {
    if (!x) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
};

/**
 * useTitleDiaryBulk
 *
 * Fetches status + rating for a list of title UUIDs.
 * Intentionally avoids per-row queries in search lists.
 */
export const useTitleDiaryBulk = (rawTitleIds: string[]) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const titleIds = React.useMemo(() => {
    const cleaned = uniq((rawTitleIds ?? []).filter((id) => isUuid(id)));
    // Keep query size reasonable.
    return cleaned.slice(0, 200);
  }, [rawTitleIds]);

  const idsKey = React.useMemo(() => titleIds.slice().sort().join(","), [titleIds]);

  return useQuery({
    queryKey: ["search", "titleDiaryBulk", userId, idsKey],
    enabled: Boolean(userId) && titleIds.length > 0,
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Map<string, TitleDiarySummary>> => {
      if (!userId || titleIds.length === 0) return new Map();

      const map = new Map<string, TitleDiarySummary>();

      const [{ data: entries, error: entriesError }, { data: ratings, error: ratingsError }] =
        await Promise.all([
          supabase
            .from("library_entries")
            .select("title_id,status")
            .eq("user_id", userId)
            .in("title_id", titleIds),
          supabase
            .from("ratings")
            .select("title_id,rating")
            .eq("user_id", userId)
            .in("title_id", titleIds),
        ]);

      if (entriesError) throw entriesError;
      if (ratingsError) throw ratingsError;

      (entries ?? []).forEach((row: any) => {
        const id = row?.title_id as string | undefined;
        if (!id) return;
        map.set(id, { status: (row?.status as DiaryStatus) ?? null, rating: null });
      });

      (ratings ?? []).forEach((row: any) => {
        const id = row?.title_id as string | undefined;
        if (!id) return;
        const stars = rating0_10ToStars(row?.rating ?? null);
        const current = map.get(id) ?? { status: null, rating: null };
        map.set(id, { ...current, rating: stars });
      });

      return map;
    },
  });
};
