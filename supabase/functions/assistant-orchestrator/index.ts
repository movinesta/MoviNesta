// supabase/functions/assistant-orchestrator/index.ts
//
// Generates proactive suggestions (and tool actions) per surface.
//
// IMPORTANT:
// - Suggestions are cached per (user_id, context_key) to avoid churn.
// - Actions are deterministic and executed server-side via assistant-suggestion-action.

import { getRequestId, handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getConfig } from "../_shared/config.ts";
import { getAssistantSettings, resolveAssistantBehavior, type AssistantBehavior } from "../_shared/assistantSettings.ts";
import { openrouterChatWithFallback } from "../_shared/openrouter.ts";
import { resolveZdrRouting, type ZdrRoutingMeta } from "../_shared/openrouterZdr.ts";
import { type ActiveGoal, type AssistantPlaybookId } from "../_shared/assistantPlaybooks.ts";
import { buildRewriteSystemPrompt, type AssistantSurface } from "./promptPacks.ts";
import { safeInsertOpenRouterUsageLog } from "../_shared/openrouterUsageLog.ts";

type AssistantAction =
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

type AssistantSuggestion = {
  id: string;
  kind: string;
  title: string;
  body: string;
  actions: AssistantAction[];
  createdAt: string;
};

type ActiveGoalSummary = {
  id: string;
  kind: string;
  title: string;
  status: string;
  endAt: string | null;
  targetCount: number;
  progressCount: number;
  listId: string | null;
};

type DraftSuggestion = {
  kind: string;
  title: string;
  body: string;
  actions: AssistantAction[];
  score?: number;
};

type AssistantPrefs = {
  enabled: boolean;
  proactivityLevel: 0 | 1 | 2;
};

function nowIso() {
  return new Date().toISOString();
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function toContextKey(surface: AssistantSurface, context: Record<string, unknown> | null | undefined) {
  const c = context ?? {};
  // Keep this stable and intentionally coarse. We don't want a new key for tiny changes.
  const stable: Record<string, unknown> = { surface };
  if (surface === "title" && typeof c.titleId === "string") stable.titleId = c.titleId;
  if (surface === "messages" && typeof c.conversationId === "string") stable.conversationId = c.conversationId;
  if (surface === "swipe" && typeof c.sessionId === "string") stable.sessionId = c.sessionId;
  // Normalize search queries to reduce cache churn (case/spacing changes shouldn't create new keys).
  if (surface === "search" && typeof c.query === "string") {
    const q = String(c.query).trim().toLowerCase().replace(/\s+/g, " ");
    stable.query = q.slice(0, 60);
  }
  // Home/diary: nothing else.
  return JSON.stringify(stable);
}

function ttlMinutesFor(surface: AssistantSurface, orch?: AssistantBehavior["orchestrator"]): number {
  const ttl = (orch?.ttl_minutes ?? {}) as Record<string, unknown>;
  const v = ttl[surface] ?? ttl.default;
  if (typeof v === "number" && Number.isFinite(v)) return clampInt(v, 1, 24 * 60);
  // Back-compat defaults.
  switch (surface) {
    case "swipe":
    case "messages":
      return 30;
    case "search":
      return 60;
    case "title":
      return 6 * 60;
    case "diary":
      return 6 * 60;
    case "home":
    default:
      return 12 * 60;
  }
}

function cooldownMinutesFor(
  surface: AssistantSurface,
  proactivityLevel: 0 | 1 | 2,
  orch?: AssistantBehavior["orchestrator"],
): number {
  const cm = orch?.cooldown_minutes;
  const levelKey = proactivityLevel === 2 ? "level2" : proactivityLevel === 1 ? "level1" : "level0";
  const per = (cm as any)?.[levelKey] as Record<string, unknown> | undefined;
  const v = per ? (per[surface] ?? per.default) : undefined;
  if (typeof v === "number" && Number.isFinite(v)) return clampInt(v, 1, 24 * 60);

  // Back-compat defaults.
  if (proactivityLevel === 2) {
    return surface === "swipe" ? 5 : 8;
  }
  if (proactivityLevel === 1) {
    return surface === "swipe" ? 10 : 15;
  }
  return 60;
}

function dailyCapFor(proactivityLevel: 0 | 1 | 2, orch?: AssistantBehavior["orchestrator"]): number {
  const dc = orch?.daily_cap;
  const v = proactivityLevel === 2 ? dc?.level2 : proactivityLevel === 1 ? dc?.level1 : dc?.level0;
  if (typeof v === "number" && Number.isFinite(v)) return clampInt(v, 0, 200);
  // Back-compat defaults.
  if (proactivityLevel === 2) return 20;
  if (proactivityLevel === 1) return 12;
  return 0;
}

async function loadAssistantPrefs(supabase: any, userId: string): Promise<AssistantPrefs> {
  try {
    const { data, error } = await supabase
      .from("assistant_prefs")
      .select("enabled, proactivity_level")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { enabled: true, proactivityLevel: 1 };
    const enabled = typeof (data as any)?.enabled === "boolean" ? (data as any).enabled : true;
    const raw = (data as any)?.proactivity_level;
    const proactivityLevel = raw === 0 || raw === 1 || raw === 2 ? raw : 1;
    return { enabled, proactivityLevel };
  } catch {
    // If schema isn't applied yet, default to enabled.
    return { enabled: true, proactivityLevel: 1 };
  }
}

async function loadAssistantStyle(
  supabase: any,
  userId: string,
  fallbackVerbosityPreference: number,
): Promise<{
  verbosityPreference: number;
}> {
  try {
    const { data, error } = await supabase
      .from("assistant_memory")
      .select("value")
      .eq("user_id", userId)
      .eq("key", "assistant_style")
      .maybeSingle();
    if (error) {
      if (String(error.message ?? "").includes("assistant_memory")) {
        return { verbosityPreference: fallbackVerbosityPreference };
      }
      return { verbosityPreference: fallbackVerbosityPreference };
    }
    const value = (data as any)?.value ?? {};
    const v = Number(value?.verbosityPreference ?? fallbackVerbosityPreference);
    return {
      verbosityPreference: Number.isFinite(v)
        ? Math.max(0.1, Math.min(0.9, v))
        : Math.max(0.1, Math.min(0.9, fallbackVerbosityPreference)),
    };
  } catch {
    return {
      verbosityPreference: Math.max(0.1, Math.min(0.9, fallbackVerbosityPreference)),
    };
  }
}


async function loadActiveGoal(supabase: any, userId: string): Promise<ActiveGoal | null> {
  try {
    const { data, error } = await supabase
      .from("assistant_memory")
      .select("value")
      .eq("user_id", userId)
      .eq("key", "active_goal")
      .maybeSingle();
    if (error) {
      if (String(error.message ?? "").includes("assistant_memory")) return null;
      return null;
    }
    const value = (data as any)?.value;
    if (!value || typeof value !== "object") return null;
    const playbookId = String((value as any).playbookId ?? "");
    if (playbookId !== "weekly_watch_plan") return null;
    const startedAt = String((value as any).startedAt ?? "");
    const listId = typeof (value as any).listId === "string" ? (value as any).listId : null;
    const step = typeof (value as any).step === "string" ? (value as any).step : null;
    return {
      playbookId: playbookId as AssistantPlaybookId,
      startedAt: startedAt || new Date().toISOString(),
      ...(listId ? { listId } : {}),
      ...(step ? { step } : {}),
    } as ActiveGoal;
  } catch {
    return null;
  }
}

async function loadActiveGoalSummary(supabase: any, userId: string): Promise<ActiveGoalSummary | null> {
  try {
    const { data: goal, error: goalErr } = await supabase
      .from("assistant_goals")
      .select("id, kind, title, status, end_at, meta")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goalErr) {
      if (String(goalErr.message ?? "").includes("assistant_goals")) return null; // schema not applied
      return null;
    }
    if (!goal) return null;

    const goalId = String((goal as any).id);
    const { data: state, error: stateErr } = await supabase
      .from("assistant_goal_state")
      .select("target_count, progress_count")
      .eq("goal_id", goalId)
      .maybeSingle();

    const targetCountRaw = Number((state as any)?.target_count ?? (goal as any)?.meta?.targetCount ?? (goal as any)?.meta?.target_count ?? 0);
    const progressCountRaw = Number((state as any)?.progress_count ?? 0);
    const targetCount = Number.isFinite(targetCountRaw) ? Math.max(0, Math.min(99, Math.floor(targetCountRaw))) : 0;
    const progressCount = Number.isFinite(progressCountRaw) ? Math.max(0, Math.min(99, Math.floor(progressCountRaw))) : 0;

    if (stateErr && String(stateErr.message ?? "").includes("assistant_goal_state")) {
      // schema partially missing; still return basic info
    }

    const listId = typeof (goal as any)?.meta?.listId === "string" ? String((goal as any).meta.listId) : null;
    return {
      id: goalId,
      kind: String((goal as any).kind ?? ""),
      title: String((goal as any).title ?? ""),
      status: String((goal as any).status ?? ""),
      endAt: (goal as any).end_at ? String((goal as any).end_at) : null,
      targetCount,
      progressCount,
      listId,
    };
  } catch {
    return null;
  }
}

async function isInDismissCooldown(supabase: any, userId: string, surface: AssistantSurface, cooldownMin: number) {
  if (cooldownMin <= 0) return false;
  const since = new Date(Date.now() - cooldownMin * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from("assistant_suggestions")
      .select("dismissed_at")
      .eq("user_id", userId)
      .eq("surface", surface)
      .not("dismissed_at", "is", null)
      .gte("dismissed_at", since)
      .order("dismissed_at", { ascending: false })
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function loadPendingTriggerSuggestions(
  supabase: any,
  userId: string,
  surface: AssistantSurface,
  limit: number,
): Promise<AssistantSuggestion[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("assistant_suggestions")
    .select("id, kind, title, body, actions, created_at, score")
    .eq("user_id", userId)
    .eq("surface", surface)
    .like("context_key", "trigger:%")
    .is("shown_at", null)
    .is("dismissed_at", null)
    .is("accepted_at", null)
    .gte("created_at", cutoff)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data || !data.length) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    actions: (r.actions ?? []) as AssistantAction[],
    createdAt: r.created_at,
  }));
}

async function markSuggestionsShown(supabase: any, userId: string, ids: string[]) {
  if (!ids.length) return;
  // Best-effort; don't fail the request if telemetry write fails.
  try {
    await supabase
      .from("assistant_suggestions")
      .update({ shown_at: nowIso() })
      .eq("user_id", userId)
      .in("id", ids)
      .is("shown_at", null);
  } catch {
    // ignore
  }
}

async function exceededDailyCap(supabase: any, userId: string, cap: number) {
  if (cap <= 0) return true;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const { count, error } = await supabase
      .from("assistant_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (error) return false;
    return (count ?? 0) >= cap;
  } catch {
    return false;
  }
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function coerceSurface(x: unknown): AssistantSurface {
  const s = String(x ?? "").toLowerCase();
  if (s === "home" || s === "swipe" || s === "search" || s === "title" || s === "diary" || s === "messages") {
    return s as AssistantSurface;
  }
  return "home";
}

function coerceObject(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

function inferContentTypeFromMediaKind(kind: string | null | undefined): "movie" | "series" | "anime" {
  const k = String(kind ?? "").toLowerCase();
  if (k === "anime") return "anime";
  if (k === "series" || k === "episode") return "series";
  return "movie";
}

async function loadTitleBasics(
  supabase: any,
  titleId: string,
): Promise<{ id: string; name: string; kind: string } | null> {
  const { data, error } = await supabase
    .from("media_items")
    .select("id, kind, tmdb_title, tmdb_name, omdb_title")
    .eq("id", titleId)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;

  const name =
    (data as any).tmdb_title || (data as any).tmdb_name || (data as any).omdb_title || "Untitled";
  return { id: (data as any).id, kind: (data as any).kind, name };
}

async function loadRecentLikes(
  supabase: any,
  userId: string,
  opts?: { sessionId?: string | null; limit?: number },
): Promise<{ titleId: string; kind: string }[]> {
  const q = supabase
    .from("media_events")
    .select("media_item_id, event_type")
    .eq("user_id", userId)
    .eq("event_type", "like")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 10);

  if (opts?.sessionId) {
    q.eq("session_id", opts.sessionId);
  }

  const { data, error } = await q;
  if (error) return [];
  const ids = Array.from(new Set(((data as any[]) ?? []).map((r) => r.media_item_id).filter(Boolean)));
  if (!ids.length) return [];

  const { data: items } = await supabase
    .from("media_items")
    .select("id, kind")
    .in("id", ids)
    .limit(50);

  const byId = new Map<string, string>();
  (items as any[] | null | undefined)?.forEach((r) => byId.set(r.id, r.kind));

  return ids.map((id) => ({ titleId: id, kind: byId.get(id) ?? "movie" }));
}

function makeActionsForDraft(surface: AssistantSurface, context: Record<string, unknown>, d: DraftSuggestion) {
  const actions: AssistantAction[] = [];

  // Always include a dismiss.
  actions.push({ id: "dismiss", label: "Dismiss", type: "dismiss" });

  // Deterministic mappings by kind.
  if (d.kind === "create_list" && (d.actions?.length ?? 0) === 0) {
    // If caller didn't set explicit actions, leave as-is.
  }

  // If draft contains its own primary action, keep it.
  return d.actions?.length ? [...d.actions, ...actions] : actions;
}

async function maybeRewriteCopy(
  surface: AssistantSurface,
  drafts: DraftSuggestion[],
  opts?: {
    preferCreative?: boolean;
    avoidPhrases?: string[];
    verbosityPreference?: number;
    /** Role-based routing: maker is higher quality; rewriter is cheap polish */
    role?: "maker" | "rewriter";
    usageLogger?: UsageLogger;
  },
): Promise<{ rewritten: DraftSuggestion[]; model?: string; usage?: unknown } | null> {
  const cfg = getConfig();
  if (!cfg.openrouterApiKey) return null;
  if (!drafts.length) return null;

  const settings = await getAssistantSettings();
  const admin = getAdminClient();
  const baseUrlFallback = settings.openrouter_base_url ?? cfg.openrouterBaseUrl ?? null;
  const { base_url: baseUrl, meta: zdrMeta } = await resolveZdrRouting({
    svc: admin,
    base_url: baseUrlFallback,
    behavior: (settings as any)?.behavior ?? resolveAssistantBehavior(null),
    sensitive: true,
  });
  const role = opts?.role ?? "rewriter";
  const primary =
    role === "maker"
      ? (opts?.preferCreative ? settings.model_maker ?? settings.model_creative : settings.model_maker ?? settings.model_fast)
      : opts?.preferCreative
        ? settings.model_creative
        : settings.model_fast;

  const models: string[] = [
    primary,
    settings.model_fast,
    settings.model_creative,
    ...settings.fallback_models,
  ].filter(Boolean) as string[];
  if (!models.length) return null;

  const pref = Number(opts?.verbosityPreference ?? 0.45);
  const p = Number.isFinite(pref) ? Math.max(0.1, Math.min(0.9, pref)) : 0.45;
  let maxBodyWords = p < 0.35 ? 18 : p < 0.65 ? 26 : 36;
  let maxTitleWords = p < 0.35 ? 6 : p < 0.65 ? 7 : 8;

  // Surface-specific tightening/loosening.
  if (surface === "messages") {
    maxBodyWords -= 6;
    maxTitleWords = Math.min(maxTitleWords, 6);
  }
  if (surface === "swipe") maxBodyWords -= 4;
  if (surface === "home") maxBodyWords -= 2;
  if (surface === "diary") maxBodyWords += 4;
  if (surface === "title") maxBodyWords += 2;

  const system = buildRewriteSystemPrompt(surface, {
    maxTitleWords,
    maxBodyWords,
  });
  const avoid = (opts?.avoidPhrases ?? []).slice(0, 12);

  // Token saver: skip the copywriter pass when drafts already satisfy constraints.
  if (!needsRewriteCopy(drafts, { maxTitleWords, maxBodyWords, avoid })) {
    return null;
  }

  const user = {
    s: drafts.map((d) => [d.title, d.body]),
    a: avoid,
  };

  const response_format = {
    type: "json_schema" as const,
    json_schema: {
      name: "MoviNestaRewriteResponse",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          s: {
            type: "array",
            items: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: { type: "string" },
            },
          },
        },
        required: ["s"],
      },
    },
  };

  try {
    const defaultInstructions =
      (settings.params as any)?.instructions ?? settings.default_instructions ?? undefined;
    const res = await openrouterChatWithFallback({
      models,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
      response_format,
      plugins: OR_PLUGINS,
      defaults: {
        ...(settings.params ?? {}),
        instructions: defaultInstructions,
        attribution: (settings as any)?.behavior?.router?.attribution ?? undefined,
        base_url: baseUrl ?? undefined,
      },
    });
    opts?.usageLogger?.({
      completion: res,
      stage: role === "maker" ? "maker" : "rewriter",
      baseUrl,
      zdr: zdrMeta,
    });
    const parsed = safeJsonParse<{ s: string[][] }>(res.content);
    if (!parsed?.s?.length) return null;

    const rewritten = drafts.map((d, idx) => {
      const r = parsed.s[idx];
      if (!r) return d;
      return {
        ...d,
        title: typeof r?.[0] === "string" && r[0].trim() ? r[0].trim() : d.title,
        body: typeof r?.[1] === "string" && r[1].trim() ? r[1].trim() : d.body,
      };
    });
    return { rewritten, model: res.model ?? models[0], usage: res.usage };
  } catch {
    return null;
  }
}

function needsRewriteCopy(
  drafts: DraftSuggestion[],
  opts: { maxTitleWords: number; maxBodyWords: number; avoid: string[] },
): boolean {
  const emoji = /\p{Extended_Pictographic}/u;
  const avoid = (opts.avoid ?? []).map((s) => String(s).toLowerCase()).filter(Boolean);
  const countWords = (s: string) => (s.trim().match(/\S+/g) ?? []).length;

  for (const d of drafts) {
    const title = String(d.title ?? "");
    const body = String(d.body ?? "");
    if (emoji.test(title) || emoji.test(body)) return true;
    if (countWords(title) > opts.maxTitleWords) return true;
    if (countWords(body) > opts.maxBodyWords) return true;
    const l = `${title} ${body}`.toLowerCase();
    if (avoid.some((p) => p && l.includes(p))) return true;
  }
  return false;
}

function isAllowedActionType(t: string) {
  return (
    t === "dismiss" ||
    t === "navigate" ||
    t === "toolchain" ||
    t === "create_list" ||
    t === "diary_set_status" ||
    t === "message_send" ||
    t === "list_add_item" ||
    t === "playbook_start" ||
    t === "playbook_end"
  );
}

function safeActionId(fallback: string) {
  try {
    return crypto.randomUUID();
  } catch {
    return fallback;
  }
}

function sanitizeDraftActions(actions: unknown): AssistantAction[] {
  if (!Array.isArray(actions)) return [];
  const out: AssistantAction[] = [];

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i] as any;
    if (!a || typeof a !== "object") continue;
    const type = typeof a.type === "string" ? a.type : "";
    if (!isAllowedActionType(type)) continue;
    const id = typeof a.id === "string" && a.id.trim() ? a.id.trim() : safeActionId(`a-${i}`);
    const label = typeof a.label === "string" && a.label.trim() ? a.label.trim() : "";

    if (type === "dismiss") {
      out.push({ id, label: label || "Dismiss", type: "dismiss" });
      continue;
    }

    if (type === "navigate") {
      const to = typeof a?.payload?.to === "string" ? a.payload.to : null;
      if (!to) continue;
      out.push({ id, label: label || "Open", type: "navigate", payload: { to } });
      continue;
    }

    if (type === "toolchain") {
      const stepsRaw = Array.isArray(a?.payload?.steps) ? a.payload.steps : [];
      const steps = (stepsRaw as any[])
        .filter((s) => s && typeof s === "object" && typeof s.tool === "string")
        .slice(0, 10)
        .map((s) => ({ tool: String(s.tool), args: (s.args && typeof s.args === "object" ? s.args : {}) as Record<string, unknown> }));
      if (!steps.length) continue;
      const navigateStrategy = ["first", "last", "none"].includes(String(a?.payload?.navigateStrategy))
        ? (String(a.payload.navigateStrategy) as any)
        : undefined;
      out.push({ id, label: label || "Do it", type: "toolchain", payload: { steps, ...(navigateStrategy ? { navigateStrategy } : {}) } } as any);
      continue;
    }

    // Remaining types are tool-like (executed on the server).
    const payload = a.payload && typeof a.payload === "object" ? a.payload : {};
    out.push({ id, label: label || "Do", type: type as any, payload } as any);
  }

  // Ensure there is always a dismiss at the end.
  if (!out.some((a) => a.type === "dismiss")) {
    out.push({ id: "dismiss", label: "Dismiss", type: "dismiss" });
  }

  return out;
}

// Legacy shape (kept for safety when models don't comply).
type PlannerResponse = { suggestions: Array<{ kind?: string; title?: string; body?: string; actions?: unknown; score?: number }> };

const OR_PLUGINS = [{ id: "response-healing" }];

type UsageLogger = (entry: { completion: any; stage: string; baseUrl?: string | null; zdr?: ZdrRoutingMeta | null }) => void;

function extractUpstreamRequestId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate =
    (raw as any).id ??
    (raw as any).request_id ??
    (raw as any).requestId ??
    null;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

// Token-lean shapes (short keys) for LLM inputs/outputs.
type PlannerResponseV2 = { s: Array<{ k?: string; t?: string; b?: string; a?: unknown; s?: number }> };

async function maybePlanExtraDraftsWithPlanner(args: {
  supabase: any;
  userId: string;
  surface: AssistantSurface;
  context: Record<string, unknown>;
  activeGoal: ActiveGoal | null;
  needCount: number;
  avoidTitles: string[];
  usageLogger?: UsageLogger;
}): Promise<{ drafts: DraftSuggestion[]; model?: string; usage?: unknown } | null> {
  const cfg = getConfig();
  if (!cfg.openrouterApiKey) return null;
  const need = Math.max(0, Math.min(3, args.needCount));
  if (!need) return null;

  // Keep planner calls cheap + rare (only when we have fewer deterministic drafts).
  const settings = await getAssistantSettings();
  const admin = getAdminClient();
  const baseUrlFallback = settings.openrouter_base_url ?? cfg.openrouterBaseUrl ?? null;
  const { base_url: baseUrl, meta: zdrMeta } = await resolveZdrRouting({
    svc: admin,
    base_url: baseUrlFallback,
    behavior: (settings as any)?.behavior ?? resolveAssistantBehavior(null),
    sensitive: true,
  });
  const models: string[] = [
    settings.model_planner,
    settings.model_fast,
    ...settings.fallback_models,
  ].filter(Boolean) as string[];
  if (!models.length) return null;

  const compactContext: Record<string, unknown> = {};
  for (const k of Object.keys(args.context ?? {})) {
    const v = (args.context as any)[k];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
      compactContext[k] = v;
      continue;
    }
    if (Array.isArray(v) && v.length <= 12 && v.every((x) => typeof x === "string" || typeof x === "number")) {
      compactContext[k] = v;
      continue;
    }
  }

  const goalText = args.activeGoal
    ? {
        playbookId: args.activeGoal.playbookId,
        title: args.activeGoal.title,
        step: args.activeGoal.step,
      }
    : null;

  // Token saver: keep the system prompt stable and the user payload compact.
  const sys = [
    "You are an assistant PLANNER embedded inside a movie discovery app.",
    "Propose proactive, context-aware suggestions that trigger one-tap actions.",
    "Return ONLY valid JSON. No markdown. No commentary.",
    "No emojis. Do not mention being an AI/model.",
    "Constraints: title <= 7 words; body <= 28 words.",
    "Allowed action types: dismiss, navigate, create_list, diary_set_status, list_add_item, message_send, playbook_start, playbook_end, toolchain.",
    "Action shapes:",
    "- dismiss: {id,label,type:'dismiss'}",
    "- navigate: {id,label,type:'navigate',payload:{to}}",
    "- toolchain: {id,label,type:'toolchain',payload:{steps:[{tool,args}],navigateStrategy?}}",
    "- create_list/list_add_item/diary_set_status/message_send/playbook_start/playbook_end: {id,label,type:'<tool>',payload:{...}}",
    "Output: {s:[{k:kind,t:title,b:body,a:actions,s:score?}]} (order doesn't matter).",
  ].join("\n");

  const user = {
    s: args.surface,
    c: compactContext,
    g: goalText,
    n: need,
    a: args.avoidTitles.slice(0, 8),
  };

  const response_format = {
    type: "json_schema" as const,
    json_schema: {
      name: "MoviNestaPlannerResponse",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          s: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                k: { type: "string" },
                t: { type: "string" },
                b: { type: "string" },
                a: { type: ["array", "object", "null"] as any },
                s: { type: "number" },
              },
              required: ["t", "b"],
            },
          },
        },
        required: ["s"],
      },
    },
  };

  try {
    const defaultInstructions =
      (settings.params as any)?.instructions ?? settings.default_instructions ?? undefined;
    const res = await openrouterChatWithFallback({
      models,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(user) },
      ],
      response_format,
      plugins: OR_PLUGINS,
      defaults: {
        ...(settings.params ?? {}),
        instructions: defaultInstructions,
        attribution: (settings as any)?.behavior?.router?.attribution ?? undefined,
        base_url: baseUrl ?? undefined,
      },
    });
    args.usageLogger?.({ completion: res, stage: "planner", baseUrl, zdr: zdrMeta });

    const parsedV2 = safeJsonParse<PlannerResponseV2>(res.content);
    const parsedLegacy = safeJsonParse<PlannerResponse>(res.content);
    const rawSuggestions =
      (parsedV2?.s && Array.isArray(parsedV2.s) ? parsedV2.s : null) ??
      (parsedLegacy?.suggestions && Array.isArray(parsedLegacy.suggestions) ? parsedLegacy.suggestions : []);

    const suggestions = rawSuggestions.slice(0, need);
    if (!suggestions.length) return null;

    const drafts: DraftSuggestion[] = suggestions
      .map((s: any, idx) => {
        const title = typeof s.t === "string" ? s.t.trim() : typeof s.title === "string" ? s.title.trim() : "";
        const body = typeof s.b === "string" ? s.b.trim() : typeof s.body === "string" ? s.body.trim() : "";
        const kindRaw = typeof s.k === "string" ? s.k : typeof s.kind === "string" ? s.kind : "insight";
        const kind = kindRaw && String(kindRaw).trim() ? String(kindRaw).trim() : "insight";
        if (!title || !body) return null;
        const actions = sanitizeDraftActions((s as any).a ?? (s as any).actions);
        const score =
          typeof (s as any).s === "number" && Number.isFinite((s as any).s)
            ? Math.max(0, Math.min(1, (s as any).s))
            : typeof (s as any).score === "number" && Number.isFinite((s as any).score)
              ? Math.max(0, Math.min(1, (s as any).score))
              : 0.25;

        // Ensure unique ids for planner actions (avoid collisions with the built-ins).
        const fixedActions = actions.map((a, i) => ({ ...a, id: a.id === "dismiss" ? `dismiss_${idx}` : a.id || `a_${idx}_${i}` }));
        return { kind, title, body, actions: fixedActions, score } as DraftSuggestion;
      })
      .filter(Boolean) as DraftSuggestion[];

    if (!drafts.length) return null;
    return { drafts, model: res.model ?? models[0], usage: res.usage };
  } catch {
    return null;
  }
}

// Legacy shape (kept for safety when models don't comply).
type CriticResponse = { items: Array<{ keep?: boolean; score?: number }> };
// Token-lean shape.
type CriticResponseV2 = { i: Array<{ k?: boolean; s?: number }> };

async function maybeCriticRankDrafts(args: {
  surface: AssistantSurface;
  drafts: DraftSuggestion[];
  avoidTitles: string[];
  usageLogger?: UsageLogger;
}): Promise<{ drafts: DraftSuggestion[]; model?: string; usage?: unknown } | null> {
  const cfg = getConfig();
  if (!cfg.openrouterApiKey) return null;
  if (args.drafts.length < 2) return null;

  const settings = await getAssistantSettings();
  const admin = getAdminClient();
  const baseUrlFallback = settings.openrouter_base_url ?? cfg.openrouterBaseUrl ?? null;
  const { base_url: baseUrl, meta: zdrMeta } = await resolveZdrRouting({
    svc: admin,
    base_url: baseUrlFallback,
    behavior: (settings as any)?.behavior ?? resolveAssistantBehavior(null),
    sensitive: true,
  });
  const models: string[] = [
    settings.model_critic,
    settings.model_fast,
    ...settings.fallback_models,
  ].filter(Boolean) as string[];
  if (!models.length) return null;

  const sys = [
    "You are a CRITIC for assistant suggestions.",
    "Be strict about relevance, redundancy, and annoyance.",
    "Return ONLY valid JSON. No markdown.",
    "Output: {i:[{k:keep,s:score}]} with same length as input.",
    "Rules: drop repetitive/generic items; score higher if actionable and perfectly matched to the surface; prefer shorter copy; avoid duplicates.",
  ].join("\n");

  const user = {
    s: args.surface,
    a: args.avoidTitles.slice(0, 8),
    i: args.drafts.map((d) => ({ k: d.kind, t: d.title, b: d.body })),
  };

  const response_format = {
    type: "json_schema" as const,
    json_schema: {
      name: "MoviNestaCriticResponse",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          i: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                k: { type: "boolean" },
                s: { type: "number" },
              },
            },
          },
        },
        required: ["i"],
      },
    },
  };

  try {
    const defaultInstructions =
      (settings.params as any)?.instructions ?? settings.default_instructions ?? undefined;
    const res = await openrouterChatWithFallback({
      models,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(user) },
      ],
      response_format,
      plugins: OR_PLUGINS,
      defaults: {
        ...(settings.params ?? {}),
        instructions: defaultInstructions,
        attribution: (settings as any)?.behavior?.router?.attribution ?? undefined,
        base_url: baseUrl ?? undefined,
      },
    });
    args.usageLogger?.({ completion: res, stage: "critic", baseUrl, zdr: zdrMeta });

    const parsedV2 = safeJsonParse<CriticResponseV2>(res.content);
    const parsedLegacy = safeJsonParse<CriticResponse>(res.content);
    const items =
      (parsedV2?.i && Array.isArray(parsedV2.i) ? parsedV2.i : null) ??
      (parsedLegacy?.items && Array.isArray(parsedLegacy.items) ? parsedLegacy.items : []);
    if (!items.length) return null;

    const scored = args.drafts
      .map((d, idx) => {
        const it = items[idx] ?? {};
        const keep = typeof (it as any).k === "boolean" ? (it as any).k : typeof (it as any).keep === "boolean" ? (it as any).keep : true;
        const sRaw =
          typeof (it as any).s === "number" && Number.isFinite((it as any).s)
            ? (it as any).s
            : typeof (it as any).score === "number" && Number.isFinite((it as any).score)
              ? (it as any).score
              : d.score ?? 0.25;
        const s = Math.max(0, Math.min(1, sRaw));
        return { d, keep, s };
      })
      .filter((x) => x.keep)
      .sort((a, b) => b.s - a.s)
      .map((x) => ({ ...x.d, score: x.s }));

    if (!scored.length) return null;
    return { drafts: scored, model: res.model ?? models[0], usage: res.usage };
  } catch {
    return null;
  }
}

async function loadRecentSuggestionKinds(supabase: any, userId: string, surface: AssistantSurface) {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from("assistant_suggestions")
      .select("kind, title")
      .eq("user_id", userId)
      .eq("surface", surface)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) return { kinds: new Set<string>(), titles: [] as string[] };
    const kinds = new Set<string>();
    const titles: string[] = [];
    (data as any[] | null | undefined)?.forEach((r) => {
      if (r?.kind) kinds.add(String(r.kind));
      if (r?.title) titles.push(String(r.title));
    });
    return { kinds, titles };
  } catch {
    return { kinds: new Set<string>(), titles: [] as string[] };
  }
}

async function buildDrafts(
  supabase: any,
  userId: string,
  surface: AssistantSurface,
  context: Record<string, unknown>,
  goal: ActiveGoal | null,
  goalSummary: ActiveGoalSummary | null,
): Promise<DraftSuggestion[]> {
  const drafts: DraftSuggestion[] = [];

  // Step 8: Long-horizon goal hint (v3 goals table)
  if (goalSummary && goalSummary.status === "active") {
    if (surface === "home") {
      const prog = `${goalSummary.progressCount}/${Math.max(goalSummary.targetCount, 0) || "?"}`;
      const ends = goalSummary.endAt ? new Date(goalSummary.endAt).toLocaleDateString() : "soon";
      drafts.push({
        kind: "goal_progress",
        title: `Goal: ${goalSummary.title}`,
        body: `Progress: ${prog}. Ends ${ends}.`,
        actions: [
          ...(goalSummary.listId
            ? [{ id: "open_goal_list", label: "Open plan", type: "navigate", payload: { to: `/lists/${goalSummary.listId}` } } as const]
            : []),
          {
            id: "end_goal",
            label: "End goal",
            type: "toolchain",
            payload: { steps: [{ tool: "goal_end", args: { goalId: goalSummary.id, status: "completed" } }], navigateStrategy: "none" },
          },
          { id: "dismiss_goal", label: "Not now", type: "dismiss" },
        ],
        score: 1.05,
      });
    }
  }

  // Goal continuation hints (cross-surface playbooks)
  if (goal && goal.playbookId === "weekly_watch_plan") {
    const listId = (goal as any).listId as string | undefined;
    if (listId) {
      if (surface === "home") {
        drafts.push({
          kind: "goal_continue",
          title: "Continue your Watch Plan",
          body: "Your plan is in progress. Open the list to tweak it, or end the plan when you’re done.",
          actions: [
            { id: "open_plan_list", label: "Open plan", type: "navigate", payload: { to: `/lists/${listId}` } },
            { id: "end_plan", label: "End plan", type: "playbook_end", payload: { playbookId: "weekly_watch_plan" } },
          ],
          score: 1.0,
        });
      }

      if (surface === "messages") {
        const conversationId = typeof context.conversationId === "string" ? context.conversationId : null;
        if (conversationId) {
          drafts.push({
            kind: "goal_share",
            title: "Share your plan",
            body: "Send your watch plan list in this chat.",
            actions: [
              {
                id: "send_plan",
                label: "Send",
                type: "message_send",
                payload: {
                  conversationId,
                  text: `I made a watch plan — want to watch these together? /lists/${listId}`,
                  meta: { kind: "assistant_playbook", playbookId: "weekly_watch_plan", listId },
                },
              },
              { id: "end_plan", label: "End plan", type: "playbook_end", payload: { playbookId: "weekly_watch_plan" } },
            ],
            score: 0.95,
          });
        }
      }

      if (surface === "title") {
        const titleId = typeof context.titleId === "string" ? context.titleId : null;
        if (titleId) {
          const infoGoal = await loadTitleBasics(supabase, titleId);
          const contentTypeGoal = infoGoal ? inferContentTypeFromMediaKind(infoGoal.kind) : "movie";
          drafts.push({
            kind: "goal_add_title",
            title: "Add this to your plan",
            body: "Keep your plan focused — add this title to your active list.",
            actions: [
              {
                id: "add_to_plan",
                label: "Add",
                type: "list_add_item",
                payload: { listId, titleId, contentType: contentTypeGoal },
              },
              { id: "open_plan_list", label: "Open plan", type: "navigate", payload: { to: `/lists/${listId}` } },
            ],
            score: 0.9,
          });
        }
      }
    }
  }

  if (surface === "title") {
    const titleId = typeof context.titleId === "string" ? context.titleId : null;
    if (!titleId) return drafts;
    const info = await loadTitleBasics(supabase, titleId);
    if (!info) return drafts;
    const contentType = inferContentTypeFromMediaKind(info.kind);

    drafts.push({
      kind: "save_to_diary",
      title: "Save for later",
      body: `Add “${info.name}” to your Watchlist so it doesn't disappear.`,
      actions: [
        {
          id: "watchlist",
          label: "Add to Watchlist",
          type: "diary_set_status",
          payload: { titleId: info.id, contentType, status: "want_to_watch" },
        },
      ],
      score: 0.9,
    });

    drafts.push({
      kind: "create_list",
      title: "Start a tiny list",
      body: `Make a list for this vibe and pin “${info.name}” as the first pick.`,
      actions: [
        {
          id: "make_list",
          label: "Create list",
          type: "create_list",
          payload: {
            name: "My picks",
            description: "Created by Assistant",
            isPublic: false,
            items: [{ titleId: info.id, contentType }],
          },
        },
      ],
      score: 0.7,
    });
  }

  if (surface === "home") {
    const likes = await loadRecentLikes(supabase, userId, { limit: 8 });
    if (likes.length >= 3) {
      drafts.push({
        kind: "create_list",
        title: "Bundle your recent likes",
        body: "Turn your latest likes into a shareable list in one tap.",
        actions: [
          {
            id: "create_recent_likes",
            label: "Create list",
            type: "create_list",
            payload: {
              name: "Recent likes",
              description: "Auto-built from your likes",
              isPublic: false,
              items: likes.slice(0, 6).map((x, idx) => ({
                titleId: x.titleId,
                contentType: inferContentTypeFromMediaKind(x.kind),
                note: idx === 0 ? "Top pick" : undefined,
              })),
            },
          },
        ],
        score: 0.8,
      });
    }

    drafts.push({
      kind: "navigate",
      title: "Get a stronger feed",
      body: "A quick swipe session trains your taste profile and improves recommendations.",
      actions: [{ id: "go_swipe", label: "Go to Swipe", type: "navigate", payload: { to: "/swipe" } }],
      score: 0.6,
    });
  }

  if (surface === "swipe") {
    const sessionId = typeof context.sessionId === "string" ? context.sessionId : null;
    const likes = await loadRecentLikes(supabase, userId, { sessionId, limit: 10 });
    if (likes.length >= 2) {
      drafts.push({
        kind: "create_list",
        title: "Save your Swipe finds",
        body: "Collect what you liked this session into a list you can come back to.",
        actions: [
          {
            id: "create_swipe_finds",
            label: "Create list",
            type: "create_list",
            payload: {
              name: "Swipe finds",
              description: "Auto-built from this swipe session",
              isPublic: false,
              items: likes.slice(0, 8).map((x) => ({
                titleId: x.titleId,
                contentType: inferContentTypeFromMediaKind(x.kind),
              })),
            },
          },
        ],
        score: 0.85,
      });
    }

    drafts.push({
      kind: "navigate",
      title: "Steer your next deck",
      body: "Use Search to like a couple of anchors, then come back to Swipe for better matches.",
      actions: [{ id: "go_search", label: "Open Search", type: "navigate", payload: { to: "/search" } }],
      score: 0.5,
    });
  }

  if (surface === "messages") {
    const conversationId = typeof context.conversationId === "string" ? context.conversationId : null;
    if (conversationId) {
      // Recommend their most recent liked title, if any.
      const likes = await loadRecentLikes(supabase, userId, { limit: 1 });
      let titleText = "a movie";
      let titleId: string | null = null;
      if (likes.length) {
        titleId = likes[0].titleId;
        const info = await loadTitleBasics(supabase, titleId);
        if (info?.name) titleText = `“${info.name}”`;
      }

      drafts.push({
        kind: "message_send",
        title: "Share a recommendation",
        body: `Drop a quick note recommending ${titleText} — it lands best while you're already chatting.`,
        actions: [
          {
            id: "send_rec",
            label: "Send",
            type: "message_send",
            payload: {
              conversationId,
              text: titleId ? `If you're looking for something to watch: ${titleText}.` : "If you're looking for something to watch, I can recommend something.",
              meta: titleId ? { kind: "recommendation", titleId } : { kind: "recommendation" },
            },
          },
        ],
        score: 0.7,
      });
    }
  }

  if (surface === "diary") {
    drafts.push({
      kind: "navigate",
      title: "Make your Diary actionable",
      body: "Pick one title and flip it to Watching — it keeps your next session focused.",
      actions: [{ id: "go_diary", label: "Open Diary", type: "navigate", payload: { to: "/diary" } }],
      score: 0.4,
    });
  }

  if (surface === "search") {
    drafts.push({
      kind: "navigate",
      title: "Anchor your taste",
      body: "Like 2–3 titles you love here, then Swipe will match the vibe faster.",
      actions: [{ id: "go_swipe", label: "Go to Swipe", type: "navigate", payload: { to: "/swipe" } }],
      score: 0.4,
    });
  }

  // Normalize: make sure every draft has dismiss.
  return drafts.map((d) => ({ ...d, actions: makeActionsForDraft(surface, context, d) }));
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const requestId = getRequestId(req);

  const validated = await validateRequest(
    req,
    (body) => {
      const b = body as any;
      const surface = coerceSurface(b?.surface);
      const context = coerceObject(b?.context);
      const requestedLimit = b?.limit;
      return { surface, context, requestedLimit };
    },
    { logPrefix: "[assistant-orchestrator]", requireJson: true },
  );
  if (validated.errorResponse) return validated.errorResponse;
  const { surface, context, requestedLimit } = validated.data;

  const supabase = getUserClient(req);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;
  if (authError || !userId) {
    return jsonError(req, "Unauthorized", 401, "UNAUTHORIZED");
  }
  const rl = await enforceRateLimit(req, { action: "assistant_orchestrator", maxPerMinute: 30 });
  if (!rl.ok) {
    return jsonError(req, rl.message, rl.status ?? 429, "RATE_LIMIT", { retryAfterSeconds: rl.retryAfterSeconds });
  }
  const admin = getAdminClient();
  const logOpenRouterUsage: UsageLogger = (entry) => {
    try {
      const completion = entry.completion ?? {};
      void safeInsertOpenRouterUsageLog(admin, {
        fn: "assistant-orchestrator",
        request_id: requestId,
        user_id: userId,
        conversation_id: null,
        provider: "openrouter",
        model: completion.model ?? null,
        base_url: entry.baseUrl ?? null,
        usage: completion.usage ?? null,
        upstream_request_id: extractUpstreamRequestId(completion.raw),
        variant: completion.variant ?? null,
        meta: { stage: entry.stage, zdr: entry.zdr ?? null },
      });
    } catch {
      // best-effort
    }
  };

  const baseContextKey = toContextKey(surface, context);

  // Active goals affect caching so continue-hints replace stale cached ideas.
  const activeGoal = await loadActiveGoal(supabase, userId);
  const activeGoalSummary = await loadActiveGoalSummary(supabase, userId);
  const goalSuffix = activeGoal ? `|goal:${activeGoal.playbookId}:${(activeGoal as any).listId ?? ""}` : "";
  const goalSuffixV3 = activeGoalSummary ? `|goalv3:${activeGoalSummary.id}` : "";
  const contextKey = `${baseContextKey}${goalSuffix}${goalSuffixV3}`;

  // Respect user prefs + anti-annoyance guardrails.
  const prefs = await loadAssistantPrefs(supabase, userId);
  if (!prefs.enabled || prefs.proactivityLevel === 0) {
    return jsonResponse(req, { ok: true, contextKey, activeGoal: activeGoalSummary, suggestions: [] });
  }

  // Admin-controlled assistant behavior (safe fallback if settings aren't deployed yet).
  let behavior: AssistantBehavior;
  try {
    const settings = await getAssistantSettings();
    behavior = (settings as any)?.behavior ? (settings as any).behavior : resolveAssistantBehavior(null);
  } catch {
    behavior = resolveAssistantBehavior(null);
  }

  const orch = behavior.orchestrator;
  const maxLimitRaw = (orch as any)?.max_suggestions_limit;
  const maxLimit = (typeof maxLimitRaw === "number" && Number.isFinite(maxLimitRaw))
    ? clampInt(maxLimitRaw, 1, 6)
    : 6;
  const defaultLimitRaw = (orch as any)?.default_suggestions_limit;
  const defaultLimit = (typeof defaultLimitRaw === "number" && Number.isFinite(defaultLimitRaw))
    ? clampInt(defaultLimitRaw, 1, maxLimit)
    : clampInt(3, 1, maxLimit);
  const requestedLimitNum = Number(requestedLimit);
  const limit = Number.isFinite(requestedLimitNum) ? clampInt(requestedLimitNum, 1, maxLimit) : defaultLimit;

  const ttlMin = ttlMinutesFor(surface, orch);
  const cutoff = new Date(Date.now() - ttlMin * 60 * 1000).toISOString();

  const style = await loadAssistantStyle(supabase, userId, orch?.default_verbosity ?? 0.45);

  const cooldownMin = cooldownMinutesFor(surface, prefs.proactivityLevel, orch);
  const inCooldown = await isInDismissCooldown(supabase, userId, surface, cooldownMin);
  if (inCooldown) {
    return jsonResponse(req, { ok: true, contextKey, activeGoal: activeGoalSummary, suggestions: [] });
  }

  const cap = dailyCapFor(prefs.proactivityLevel, orch);
  if (await exceededDailyCap(supabase, userId, cap)) {
    return jsonResponse(req, { ok: true, contextKey, activeGoal: activeGoalSummary, suggestions: [] });
  }

// Pending trigger suggestions (event-driven). These override cache so the assistant can be truly proactive.
  const pending = await loadPendingTriggerSuggestions(supabase, userId, surface, limit);
  if (pending.length) {
    await markSuggestionsShown(
      supabase,
      userId,
      pending.map((s) => s.id),
    );
    return jsonResponse(req, { ok: true, contextKey, activeGoal: activeGoalSummary, suggestions: pending });
  }

  // Try to return cached suggestions first.
  try {
    const { data: existing, error: existingError } = await supabase
      .from("assistant_suggestions")
      .select("id, kind, title, body, actions, created_at, dismissed_at, accepted_at")
      .eq("user_id", userId)
      .eq("context_key", contextKey)
      .gte("created_at", cutoff)
      .is("dismissed_at", null)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!existingError && existing && existing.length) {
      const suggestions: AssistantSuggestion[] = (existing as any[]).map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        actions: (r.actions ?? []) as AssistantAction[],
        createdAt: r.created_at,
      }));
      await markSuggestionsShown(
        supabase,
        userId,
        suggestions.map((s) => s.id),
      );
      return jsonResponse(req, { ok: true, contextKey, activeGoal: activeGoalSummary, suggestions });
    }
  } catch (e: any) {
    // Likely table missing. Degrade gracefully.
    if (String(e?.message ?? "").includes("assistant_suggestions")) {
      return jsonResponse(req, { ok: true, contextKey, activeGoal: activeGoalSummary, suggestions: [] });
    }
  }

  // Build new drafts.
  const recent = await loadRecentSuggestionKinds(supabase, userId, surface);
  const rawDrafts = (await buildDrafts(supabase, userId, surface, context, activeGoal, activeGoalSummary)).slice(0, limit);

  // Diversity: avoid repeating the same kind on the same surface within ~12h.
  const filteredDrafts = rawDrafts.filter((d) => !recent.kinds.has(d.kind));
  let drafts = (filteredDrafts.length ? filteredDrafts : rawDrafts).slice(0, limit);

  // Role-based pipeline (Planner → Maker → Critic)
  // - Planner is only used to fill gaps when deterministic rules didn't produce enough.
  // - Maker rewrites copy at higher quality when proactivity is high.
  // - Critic can filter/rank to reduce annoyance.

  let plannerTrace: { model?: string; usage?: unknown } | null = null;
  const needCount = Math.max(0, limit - drafts.length);
  if (needCount > 0) {
    const planned = await maybePlanExtraDraftsWithPlanner({
      supabase,
      userId,
      surface,
      context,
      activeGoal,
      needCount,
      avoidTitles: recent.titles,
      usageLogger: logOpenRouterUsage,
    });
    if (planned?.drafts?.length) {
      plannerTrace = { model: planned.model, usage: planned.usage };
      drafts = [...drafts, ...planned.drafts];
    }
  }

  // De-dupe by kind+title to avoid variants.
  {
    const seen = new Set<string>();
    const deduped: DraftSuggestion[] = [];
    for (const d of drafts) {
      const key = `${d.kind}::${String(d.title).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(d);
      if (deduped.length >= limit) break;
    }
    drafts = deduped;
  }
  if (!drafts.length) {
    return jsonResponse(req, { ok: true, contextKey, activeGoal: activeGoalSummary, suggestions: [] });
  }

  // Maker: higher-quality polish when we're being proactive, or when planner participated.
  const useMaker = prefs.proactivityLevel === 2 || surface === "title" || surface === "home" || Boolean(plannerTrace);
  const rewrittenResult = await maybeRewriteCopy(surface, drafts, {
    preferCreative: surface === "title" || surface === "home" || prefs.proactivityLevel === 2,
    avoidPhrases: recent.titles,
    verbosityPreference: style.verbosityPreference,
    role: useMaker ? "maker" : "rewriter",
    usageLogger: logOpenRouterUsage,
  });
  let finalDrafts = rewrittenResult?.rewritten ?? drafts;
  let model = rewrittenResult?.model ?? null;

  // Critic: only when proactivity is high and the surface is high-visibility.
  let criticTrace: { model?: string; usage?: unknown } | null = null;
  if (prefs.proactivityLevel === 2 && (surface === "home" || surface === "title")) {
    const crit = await maybeCriticRankDrafts({
      surface,
      drafts: finalDrafts,
      avoidTitles: recent.titles,
      usageLogger: logOpenRouterUsage,
    });
    if (crit?.drafts?.length) {
      criticTrace = { model: crit.model, usage: crit.usage };
      finalDrafts = crit.drafts.slice(0, limit);
    }
  }

  const usage = {
    ...(plannerTrace ? { planner: plannerTrace } : {}),
    ...(rewrittenResult ? { maker: { model: rewrittenResult.model, usage: rewrittenResult.usage } } : {}),
    ...(criticTrace ? { critic: criticTrace } : {}),
  };

  // Persist to DB.
  try {
    const rows = finalDrafts.map((d) => ({
      user_id: userId,
      surface,
      context,
      context_key: contextKey,
      kind: d.kind,
      title: d.title,
      body: d.body,
      actions: d.actions,
      score: d.score ?? 0,
      model,
      usage,
      created_at: nowIso(),
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("assistant_suggestions")
      .insert(rows)
      .select("id, kind, title, body, actions, created_at")
      .limit(limit);

    if (insertError) {
      // Degrade gracefully if schema not applied.
      if (String(insertError.message ?? "").includes("assistant_suggestions")) {
        return jsonResponse(req, { ok: true, contextKey, activeGoal: activeGoalSummary, suggestions: [] });
      }
      return jsonError(req, insertError.message, 500, "DB_ERROR");
    }

    const suggestions: AssistantSuggestion[] = ((inserted as any[]) ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      actions: (r.actions ?? []) as AssistantAction[],
      createdAt: r.created_at,
    }));

    await markSuggestionsShown(
      supabase,
      userId,
      suggestions.map((s) => s.id),
    );
    return jsonResponse(req, { ok: true, contextKey, activeGoal: activeGoalSummary, suggestions });
  } catch (e: any) {
    return jsonError(req, e?.message ?? "Failed", 500, "ASSISTANT_ERROR");
  }
});
