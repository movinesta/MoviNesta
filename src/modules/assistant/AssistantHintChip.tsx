import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/toasts";
import { queryClient } from "@/lib/react-query";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/modules/auth/AuthProvider";

import type { AssistantAction, AssistantSurface } from "./types";
import { useAssistantSuggestionAction, useAssistantSuggestions } from "./useAssistant";
import { getAssistantQuietUntil, setAssistantQuietForMs } from "./assistantQuiet";
import { useAssistantPrefs } from "./useAssistantPrefs";
import { getSeenSuggestionId, setSeenSuggestionId } from "./assistantSeen";

type Props = {
  surface: AssistantSurface;
  context: Record<string, unknown>;
  className?: string;
};

function isPrimaryAction(action: AssistantAction) {
  return action.type !== "dismiss";
}

export const AssistantHintChip: React.FC<Props> = ({ surface, context, className }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const prefsQuery = useAssistantPrefs();
  const prefs = prefsQuery.data ?? { enabled: true, proactivityLevel: 1 as const };
  const quietUntil = getAssistantQuietUntil();
  const [isQuiet, setIsQuiet] = useState(false);

  useEffect(() => {
    setIsQuiet(Date.now() < quietUntil);
  }, [quietUntil]);

  const shouldFetch = Boolean(userId) && prefs.enabled && !isQuiet;

  const { data, isLoading, isFetching, contextKey } = useAssistantSuggestions(surface, context, {
    enabled: shouldFetch,
    pausePolling: open,
    proactivityLevel: prefs.proactivityLevel,
  });
  const actionMutation = useAssistantSuggestionAction();

  const suggestions = data?.suggestions ?? [];
  const activeGoal = data?.activeGoal ?? null;
  const topId = suggestions[0]?.id ?? null;
  const hasNew = useMemo(() => {
    if (!topId) return false;
    if (open) return false;
    const seen = getSeenSuggestionId(surface, contextKey);
    return seen !== topId;
  }, [contextKey, open, surface, topId]);
  const topLabel = useMemo(() => {
    if (isLoading) return "Assistant";
    if (suggestions.length) return "Hints";
    return "Assistant";
  }, [isLoading, suggestions.length]);

  // Only show when signed in.
  if (!user) return null;

  // Avoid showing on auth screens (in case this is rendered higher up).
  if (location.pathname.startsWith("/auth")) return null;

  // User has disabled assistant.
  if (!prefs.enabled) return null;

  // Respect local quiet period.
  if (isQuiet) return null;

  const onDismiss = async (suggestionId: string) => {
    try {
      await actionMutation.mutateAsync({ suggestionId, kind: "dismiss" });
      queryClient.invalidateQueries({ queryKey: ["assistant"] });

      // Quiet the assistant briefly after a dismissal (anti-annoyance).
      // Longer quiet on non-swipe surfaces.
      const ms = surface === "swipe" ? 5 * 60_000 : 10 * 60_000;
      setAssistantQuietForMs(ms);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to dismiss");
    }
  };

  const onExecute = async (suggestionId: string, actionId: string) => {
    try {
      const res = await actionMutation.mutateAsync({ suggestionId, kind: "execute", actionId });
      queryClient.invalidateQueries({ queryKey: ["assistant"] });
      setOpen(false);

      // Brief quiet after executing so we don't immediately show more cards.
      setAssistantQuietForMs(2 * 60_000);

      if (res?.followUpSuggestions?.length) {
        // Show follow-ups immediately without waiting for a refetch.
        queryClient.setQueryData(qk.assistantSuggestions(userId, surface, contextKey), {
          ok: true,
          contextKey,
          activeGoal,
          suggestions: res.followUpSuggestions,
        });
        const nextTop = res.followUpSuggestions[0]?.id;
        if (nextTop) {
          setSeenSuggestionId(surface, contextKey, nextTop);
        }
        setOpen(true);
      }

      if (res?.navigateTo) {
        navigate(res.navigateTo);
      }
      toast.success("Done");
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    }
  };

  return (
    <div
      className={cn(
        "fixed right-4 z-40",
        // Default above bottom nav.
        "bottom-[5.5rem]",
        className,
      )}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next && topId) {
            setSeenSuggestionId(surface, contextKey, topId);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open assistant hints"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Chip
              variant={suggestions.length ? "accent" : "default"}
              className={cn(
                "shadow-sm relative",
                (isFetching || actionMutation.isPending) && "opacity-80",
              )}
            >
              {hasNew && (
                <span
                  className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
              {topLabel}
            </Chip>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[340px] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Assistant</div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-7 px-2">
              Close
            </Button>
          </div>

          {activeGoal && (
            <div className="mb-2 rounded-lg border bg-muted/40 p-2">
              <div className="text-xs font-semibold leading-snug">{activeGoal.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Progress {activeGoal.progressCount}/{activeGoal.targetCount}
                {activeGoal.endAt
                  ? ` • ends ${new Date(activeGoal.endAt).toLocaleDateString()}`
                  : ""}
              </div>
            </div>
          )}

          {suggestions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hints right now. Keep browsing — I’ll surface ideas when they’re useful.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => {
                const primary = s.actions.filter(isPrimaryAction);

                return (
                  <div key={s.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold leading-snug">{s.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 leading-snug">
                          {s.body}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => onDismiss(s.id)}
                      >
                        Dismiss
                      </Button>
                    </div>

                    {primary.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {primary.map((a) => (
                          <Button
                            key={a.id}
                            size="sm"
                            variant={a.type === "navigate" ? "secondary" : "default"}
                            onClick={() => onExecute(s.id, a.id)}
                            disabled={actionMutation.isPending}
                          >
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
