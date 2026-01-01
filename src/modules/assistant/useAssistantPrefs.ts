import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/react-query";
import { qk } from "@/lib/queryKeys";
import { useAuth } from "@/modules/auth/AuthProvider";

export type AssistantPrefs = {
  enabled: boolean;
  proactivityLevel: 0 | 1 | 2;
};

const DEFAULT_PREFS: AssistantPrefs = {
  enabled: true,
  proactivityLevel: 1,
};

export function useAssistantPrefs() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: qk.assistantPrefs(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AssistantPrefs> => {
      // NOTE: assistant tables may not exist in the local schema snapshot used for TS types.
      // So we access them as `any` to avoid build-time type errors.
      const { data, error } = await (supabase as any)
        .from("assistant_prefs")
        .select("enabled, proactivity_level")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        // If table isn't applied yet, keep defaults.
        return DEFAULT_PREFS;
      }

      return {
        enabled: typeof data?.enabled === "boolean" ? data.enabled : true,
        proactivityLevel:
          data?.proactivity_level === 0 || data?.proactivity_level === 1 || data?.proactivity_level === 2
            ? data.proactivity_level
            : 1,
      };
    },
  });
}

export function useUpdateAssistantPrefs() {
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (next: Partial<AssistantPrefs>) => {
      if (!userId) throw new Error("Not signed in");
      const current = (queryClient.getQueryData(qk.assistantPrefs(userId)) as AssistantPrefs | undefined) ??
        DEFAULT_PREFS;
      const enabled = typeof next.enabled === "boolean" ? next.enabled : current.enabled;
      const proactivityLevel =
        next.proactivityLevel === 0 || next.proactivityLevel === 1 || next.proactivityLevel === 2
          ? next.proactivityLevel
          : current.proactivityLevel;

      const { error } = await (supabase as any)
        .from("assistant_prefs")
        .upsert(
          {
            user_id: userId,
            enabled,
            proactivity_level: proactivityLevel,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (error) throw new Error(error.message);
      return { enabled, proactivityLevel } as AssistantPrefs;
    },
    onSuccess: (data) => {
      if (!userId) return;
      queryClient.setQueryData(qk.assistantPrefs(userId), data);
      queryClient.invalidateQueries({ queryKey: ["assistant"] });
    },
  });
}
