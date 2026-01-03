import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { qk } from "@/lib/queryKeys";
import { useAuth } from "@/modules/auth/AuthProvider";
import type {
  AssistantActionResponse,
  AssistantOrchestratorResponse,
  AssistantSurface,
} from "./types";

export function useAssistantSuggestions(
  surface: AssistantSurface,
  context: Record<string, unknown>,
  opts?: {
    enabled?: boolean;
    pausePolling?: boolean;
    proactivityLevel?: 0 | 1 | 2;
  },
) {
  const { user } = useAuth();
  const userId = user?.id;

  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const contextKey = useMemo(() => {
    // Keep in sync with Edge's context_key strategy.
    const stable: Record<string, unknown> = { surface };
    if (surface === "title" && typeof context.titleId === "string")
      stable.titleId = context.titleId;
    if (surface === "messages" && typeof context.conversationId === "string") {
      stable.conversationId = context.conversationId;
    }
    if (surface === "swipe" && typeof context.sessionId === "string")
      stable.sessionId = context.sessionId;
    if (surface === "search" && typeof context.query === "string") {
      stable.query = String(context.query).slice(0, 60);
    }
    return JSON.stringify(stable);
  }, [surface, context]);

  const query = useQuery({
    queryKey: qk.assistantSuggestions(userId, surface, contextKey),
    enabled: Boolean(userId) && Boolean(opts?.enabled ?? true),
    staleTime: 60_000,
    refetchInterval: (() => {
      // Proactive: gentle polling to surface hints without the user opening the chip.
      // Backend caching + caps + cooldowns prevent churn/cost.
      const proactivity = opts?.proactivityLevel ?? 1;
      const shouldPoll =
        Boolean(userId) && Boolean(opts?.enabled ?? true) && !opts?.pausePolling && isVisible;
      if (!shouldPoll) return false;
      if (proactivity <= 0) return false;

      switch (surface) {
        case "swipe":
        case "search":
        case "messages":
          return proactivity === 2 ? 60_000 : 120_000; // 1–2 min
        case "title":
          return proactivity === 2 ? 180_000 : 300_000; // 3–5 min
        case "diary":
          return 600_000; // 10 min
        case "home":
        default:
          return proactivity === 2 ? 240_000 : 420_000; // 4–7 min
      }
    })(),
    refetchIntervalInBackground: false,
    queryFn: () =>
      callSupabaseFunction<AssistantOrchestratorResponse>(
        "assistant-orchestrator",
        {
          surface,
          context,
          limit: 3,
        },
        { timeoutMs: 12_000 },
      ),
  });

  // Mark shown for the first suggestion once fetched.
  useEffect(() => {
    const first = query.data?.suggestions?.[0];
    if (!first) return;
    // Fire and forget.
    void callSupabaseFunction("assistant-suggestion-action", {
      suggestionId: first.id,
      kind: "shown",
    }).catch(() => null);
  }, [query.data?.suggestions?.[0]?.id]);

  return {
    ...query,
    contextKey,
  };
}

export function useAssistantSuggestionAction() {
  return useMutation({
    mutationFn: (input: { suggestionId: string; kind: "dismiss" | "execute"; actionId?: string }) =>
      callSupabaseFunction<AssistantActionResponse>("assistant-suggestion-action", input),
  });
}
