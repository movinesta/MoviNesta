// supabase/functions/_shared/assistantPlaybooks.ts
//
// Central definitions for assistant playbooks (multi-step, context-carrying workflows).
//
// v1: Keep it intentionally small and deterministic.

export type AssistantPlaybookId = "weekly_watch_plan";

export type ActiveGoal = {
  playbookId: AssistantPlaybookId;
  startedAt: string;
  // Workspace state (can grow over time)
  listId?: string;
  lastUpdatedAt?: string;
};

export const PLAYBOOKS: Record<AssistantPlaybookId, { title: string; description: string }> = {
  weekly_watch_plan: {
    title: "Weekly watch plan",
    description: "Turn your taste signals into a small plan you can follow and share.",
  },
};
