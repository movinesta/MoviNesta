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
      const { data, error } = await supabase
        .from("user_preferences")
        .select("assistant")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) {
        return DEFAULT_PREFS;
      }

      const assistant = (data?.assistant as any) || {};
      return {
        enabled: typeof assistant.enabled === "boolean" ? assistant.enabled : true,
        proactivityLevel:
          assistant.proactivityLevel === 0 ||
          assistant.proactivityLevel === 1 ||
          assistant.proactivityLevel === 2
            ? assistant.proactivityLevel
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

      // Fetch current state helper
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("assistant")
        .eq("user_id", userId!)
        .maybeSingle();

      const currentAssistant = (existing?.assistant as any) || {};

      const enabled =
        typeof next.enabled === "boolean" ? next.enabled : (currentAssistant.enabled ?? true);
      const proactivityLevel =
        next.proactivityLevel === 0 || next.proactivityLevel === 1 || next.proactivityLevel === 2
          ? next.proactivityLevel
          : (currentAssistant.proactivityLevel ?? 1);

      const updatedAssistant = { ...currentAssistant, enabled, proactivityLevel };

      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          assistant: updatedAssistant,
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
