// supabase/functions/assistant-orchestrator/lib/types.ts
//
// Shared types extracted from index.ts. Behavior-preserving.

import type { AssistantPlaybookId } from "../../_shared/assistantPlaybooks.ts";

export type AssistantAction =
  | { id: string; label: string; type: "dismiss" }
  | { id: string; label: string; type: "navigate"; payload: { to: string } }
  | {
    id: string;
    label: string;
    type: "toolchain";
    payload: {
      steps: { tool: string; args?: Record<string, unknown> }[];
      navigateStrategy?: "first" | "last" | "none";
    };
  }
  | {
    id: string;
    label: string;
    type: "create_list";
    payload: {
      name: string;
      description?: string;
      isPublic?: boolean;
      items?: { titleId: string; contentType: "movie" | "series" | "anime"; note?: string }[];
    };
  }
  | {
    id: string;
    label: string;
    type: "diary_set_status";
    payload: {
      titleId: string;
      contentType: "movie" | "series" | "anime";
      status: "want_to_watch" | "watching" | "watched" | "dropped";
    };
  }
  | {
    id: string;
    label: string;
    type: "message_send";
    payload: {
      conversationId?: string;
      targetUserId?: string;
      text: string;
      meta?: Record<string, unknown>;
    };
  }
  | {
    id: string;
    label: string;
    type: "list_add_item";
    payload: {
      listId: string;
      titleId: string;
      contentType: "movie" | "series" | "anime";
      note?: string;
    };
  }
  | {
    id: string;
    label: string;
    type: "playbook_start";
    payload: {
      playbookId: AssistantPlaybookId;
    };
  }
  | {
    id: string;
    label: string;
    type: "playbook_end";
    payload?: {
      playbookId?: AssistantPlaybookId;
    };
  };

export type AssistantSuggestion = {
  id: string;
  kind: string;
  title: string;
  body: string;
  actions: AssistantAction[];
  createdAt: string;
};

export type ActiveGoalSummary = {
  id: string;
  kind: string;
  title: string;
  status: string;
  endAt: string | null;
  targetCount: number;
  progressCount: number;
  listId: string | null;
};

export type DraftSuggestion = {
  kind: string;
  title: string;
  body: string;
  actions: AssistantAction[];
  score?: number;
};

export type AssistantPrefs = {
  enabled: boolean;
  proactivityLevel: 0 | 1 | 2;
};
