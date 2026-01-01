// supabase/functions/_shared/assistantTools.ts
//
// Assistant Tool Registry
// -----------------------
// Central list of tools the assistant is allowed to execute.
//
// Why this exists:
// - Prevent "free-form" LLM tool calls from doing unsafe DB writes.
// - Give playbooks a stable tool interface.
// - Allow toolchains (multi-step actions) to be executed atomically-ish
//   (best-effort sequential execution with a structured outcome).

import { getConfig } from "./config.ts";
import { openrouterChatWithFallback } from "./openrouter.ts";

export type AssistantContentType = "movie" | "series" | "anime";

export type AssistantToolName =
  | "create_list"
  | "list_add_item"
  | "diary_set_status"
  | "message_send"
  | "playbook_start"
  | "playbook_end"
  | "goal_start"
  | "goal_end"
  | "goal_get_active"
  // Read-only helper tools (safe):
  | "get_recent_likes"
  | "plan_watch_plan_copy";

export type AssistantToolCall = {
  tool: AssistantToolName;
  args?: Record<string, unknown>;
};

export type AssistantToolResult = {
  ok: true;
  tool: AssistantToolName;
  result?: unknown;
  navigateTo?: string | null;
  meta?: Record<string, unknown>;
};

function coerceString(x: unknown): string {
  return typeof x === "string" ? x : String(x ?? "");
}

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `assistant-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

async function getAssistantMemoryValue(supabase: any, userId: string, key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from("assistant_memory")
      .select("value")
      .eq("user_id", userId)
      .eq("key", key)
      .maybeSingle();
    if (error) {
      if (String(error.message ?? "").includes("assistant_memory")) return null;
      return null;
    }
    return (data as any)?.value ?? null;
  } catch {
    return null;
  }
}

async function setAssistantMemoryValue(supabase: any, userId: string, key: string, value: any | null) {
  try {
    if (value === null || value === undefined) {
      await supabase.from("assistant_memory").delete().eq("user_id", userId).eq("key", key);
      return;
    }
    await supabase.from("assistant_memory").upsert(
      { user_id: userId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" },
    );
  } catch {
    // ignore
  }
}

export function inferContentTypeFromMediaKind(kind: string | null | undefined): AssistantContentType {
  const k = String(kind ?? "").toLowerCase();
  if (k === "anime") return "anime";
  if (k === "series" || k === "episode") return "series";
  return "movie";
}

// -----------------------------------------------------------------------------
// Read-only helpers
// -----------------------------------------------------------------------------
export type RecentLike = { titleId: string; kind: AssistantContentType };

export async function getRecentLikes(supabase: any, userId: string, limit = 8): Promise<RecentLike[]> {
  try {
    const { data: events, error: eventsError } = await supabase
      .from("media_events")
      .select("title_id, created_at")
      .eq("user_id", userId)
      .eq("event_type", "like")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(50, limit)));
    if (eventsError || !events || !Array.isArray(events) || events.length === 0) return [];

    const ids: string[] = [];
    for (const e of events as any[]) {
      const id = typeof e?.title_id === "string" ? e.title_id : null;
      if (id && !ids.includes(id)) ids.push(id);
    }
    if (!ids.length) return [];

    const { data: items, error: itemsError } = await supabase.from("media_items").select("id, kind").in("id", ids);
    if (itemsError || !items || !Array.isArray(items)) return [];

    const byId = new Map<string, string>();
    (items as any[]).forEach((it) => {
      if (it?.id) byId.set(String(it.id), String(it.kind ?? "movie"));
    });

    const out: RecentLike[] = [];
    for (const id of ids) {
      const k = byId.get(id) ?? "movie";
      const kind = k === "series" || k === "anime" ? (k as AssistantContentType) : "movie";
      out.push({ titleId: id, kind });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function planWatchPlanCopy(likedTitleNames: string[]): Promise<{
  listName: string;
  description: string;
  shareMessage: string;
  model?: string;
  usage?: unknown;
} | null> {
  try {
    const cfg = getConfig();
    if (!cfg.openrouterApiKey) return null;

    const models: string[] = [cfg.openrouterModelPlanner, cfg.openrouterModelMaker, cfg.openrouterModelCreative, cfg.openrouterModelFast]
      .filter(Boolean) as string[];
    if (!models.length) return null;

    const liked = likedTitleNames.filter(Boolean).slice(0, 5);
    const likedText = liked.length ? liked.map((t) => `- ${t}`).join("\n") : "(no likes yet)";

    const res = await openrouterChatWithFallback({
      models,
      max_tokens: 220,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are a product planner for a movie discovery app. Return ONLY valid JSON. No markdown, no commentary.",
        },
        {
          role: "user",
          content: `Create copy for a compact personal watch-plan based on recent likes.\n\nRecent likes:\n${likedText}\n\nReturn JSON:\n{"listName":string,"description":string,"shareMessage":string}\nConstraints: listName <= 28 chars, description <= 80 chars, shareMessage <= 110 chars. Friendly, punchy, no emojis.`,
        },
      ],
    });

    let raw = (res.content ?? "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end >= start) raw = raw.slice(start, end + 1);

    const obj = JSON.parse(raw) as any;
    const listName = String(obj?.listName ?? "").trim();
    const description = String(obj?.description ?? "").trim();
    const shareMessage = String(obj?.shareMessage ?? "").trim();

    if (!listName) return null;

    return {
      listName: listName.slice(0, 28),
      description: description.slice(0, 80),
      shareMessage: shareMessage.slice(0, 110),
      model: res.model,
      usage: res.usage,
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Write tools
// -----------------------------------------------------------------------------

export async function toolCreateList(supabase: any, userId: string, args: any) {
  const name = coerceString(args?.name).trim();
  if (!name) throw new Error("List name is required");

  const description = typeof args?.description === "string" ? args.description.trim() : null;
  const isPublic = Boolean(args?.isPublic ?? false);
  const createdAt = new Date().toISOString();

  const { data: list, error: listError } = await supabase
    .from("lists")
    .insert({
      user_id: userId,
      name,
      description,
      is_public: isPublic,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select("id")
    .single();

  if (listError) throw new Error(listError.message);
  const listId = (list as any)?.id as string | undefined;
  if (!listId) throw new Error("Failed to create list");

  const items: any[] = Array.isArray(args?.items) ? args.items : [];
  if (items.length) {
    const rows = items
      .filter((it) => it && typeof it === "object" && typeof it.titleId === "string")
      .slice(0, 50)
      .map((it, idx) => ({
        list_id: listId,
        title_id: it.titleId,
        content_type: it.contentType,
        note: typeof it.note === "string" ? it.note.slice(0, 200) : null,
        position: idx + 1,
        created_at: createdAt,
      }));

    if (rows.length) {
      const { error: itemsError } = await supabase.from("list_items").insert(rows);
      if (itemsError) {
        console.warn("[assistantTools] Failed to insert list_items", itemsError.message);
      }
    }
  }

  return { listId, navigateTo: `/lists/${listId}` };
}

export async function toolListAddItem(supabase: any, userId: string, args: any) {
  const listId = coerceString(args?.listId);
  const titleId = coerceString(args?.titleId);
  const contentType = coerceString(args?.contentType);
  const note = typeof args?.note === "string" ? args.note.slice(0, 200) : null;
  if (!listId) throw new Error("Missing listId");
  if (!titleId) throw new Error("Missing titleId");
  if (!contentType) throw new Error("Missing contentType");

  // Ownership check.
  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (listError) throw new Error(listError.message);
  if (!list) throw new Error("List not found");

  const { data: lastRow, error: lastError } = await supabase
    .from("list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1);

  if (lastError) throw new Error(lastError.message);
  const lastPos = Array.isArray(lastRow) && lastRow.length ? Number((lastRow as any[])[0]?.position ?? 0) : 0;
  const position = (Number.isFinite(lastPos) ? lastPos : 0) + 1;

  const createdAt = new Date().toISOString();
  const { error } = await supabase.from("list_items").insert({
    list_id: listId,
    title_id: titleId,
    content_type: contentType,
    note,
    position,
    created_at: createdAt,
  });
  if (error) throw new Error(error.message);

  return { listId, titleId, position, navigateTo: `/lists/${listId}` };
}

export async function toolDiarySetStatus(supabase: any, userId: string, args: any) {
  const titleId = coerceString(args?.titleId);
  const status = coerceString(args?.status);
  const contentType = coerceString(args?.contentType);
  if (!titleId) throw new Error("Missing titleId");
  if (!status) throw new Error("Missing status");
  if (!contentType) throw new Error("Missing contentType");

  const { error } = await supabase.from("library_entries").upsert(
    {
      user_id: userId,
      title_id: titleId,
      status,
      updated_at: new Date().toISOString(),
      content_type: contentType,
    },
    { onConflict: "user_id,title_id" },
  );
  if (error) throw new Error(error.message);
  return { titleId, status };
}

export async function toolMessageSend(supabase: any, userId: string, args: any) {
  const text = coerceString(args?.text).trim();
  if (!text) throw new Error("Message text is required");

  const conversationIdRaw = typeof args?.conversationId === "string" ? args.conversationId : null;
  const targetUserId = typeof args?.targetUserId === "string" ? args.targetUserId : null;

  let conversationId = conversationIdRaw;
  if (!conversationId && targetUserId) {
    const { data, error } = await supabase.rpc("create_direct_conversation_v1", {
      p_creator_id: userId,
      p_target_user_id: targetUserId,
    });
    if (error) throw new Error(error.message);
    conversationId = (data as any)?.id ?? null;
  }

  if (!conversationId) throw new Error("Missing conversationId or targetUserId");

  const clientId = `assistant-${uuid()}`;
  const msg = {
    type: "text",
    text,
    clientId,
    assistant: true,
    ...(args?.meta && typeof args.meta === "object" ? { meta: args.meta } : {}),
  };

  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    sender_id: userId,
    body: msg,
    message_type: "text",
    text,
    client_id: clientId,
    meta: msg,
    attachment_url: null,
  });
  if (insertError) throw new Error(insertError.message);

  return { conversationId, navigateTo: `/messages/${conversationId}` };
}


// -----------------------------------------------------------------------------
// Goals (Step 8)
// -----------------------------------------------------------------------------

export async function toolGoalStart(supabase: any, userId: string, args: any) {
  const kind = coerceString(args?.kind || "weekly_watch_count") || "weekly_watch_count";
  const title = (coerceString(args?.title || "Weekly watch goal").trim() || "Weekly watch goal").slice(0, 120);
  const targetCount = Math.max(1, Math.min(12, Number(args?.targetCount ?? 3) || 3));
  const days = Math.max(1, Math.min(30, Number(args?.days ?? 7) || 7));
  const listId = typeof args?.listId === "string" && args.listId ? String(args.listId) : null;

  const startAt = new Date();
  const endAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // Insert goal (best-effort; if schema missing, no-op).
  const meta: Record<string, unknown> = { targetCount, ...(listId ? { listId } : {}) };
  const { data: inserted, error } = await supabase
    .from("assistant_goals")
    .insert({ user_id: userId, kind, title, status: "active", start_at: startAt.toISOString(), end_at: endAt.toISOString(), meta })
    .select("id")
    .maybeSingle();

  if (error) {
    if (String(error.message ?? "").includes("assistant_goals")) {
      return { goalId: null, schemaMissing: true };
    }
    throw new Error(error.message);
  }

  const goalId = String((inserted as any)?.id ?? "");
  if (goalId) {
    // Seed state row
    await supabase.from("assistant_goal_state").upsert(
      { goal_id: goalId, target_count: targetCount, progress_count: 0, updated_at: new Date().toISOString() },
      { onConflict: "goal_id" },
    );
    await setAssistantMemoryValue(supabase, userId, "active_goal_id", { goalId });
  }

  return { goalId, kind, title, targetCount, endAt: endAt.toISOString(), ...(listId ? { listId } : {}) };
}

export async function toolGoalEnd(supabase: any, userId: string, args: any) {
  const goalId = coerceString(args?.goalId);
  const status = (coerceString(args?.status || "completed").trim() || "completed").toLowerCase();
  const nextStatus = status === "cancelled" ? "cancelled" : "completed";

  // Default: end the active goal.
  let id = goalId;
  if (!id) {
    const mem = await getAssistantMemoryValue(supabase, userId, "active_goal_id");
    if (mem?.goalId) id = String(mem.goalId);
  }
  if (!id) return { ended: false };

  const { error } = await supabase
    .from("assistant_goals")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error && !String(error.message ?? "").includes("assistant_goals")) throw new Error(error.message);
  await setAssistantMemoryValue(supabase, userId, "active_goal_id", null);
  return { ended: true, goalId: id, status: nextStatus };
}

export async function toolGoalGetActive(supabase: any, userId: string) {
  try {
    const { data: goal, error } = await supabase
      .from("assistant_goals")
      .select("id, kind, title, status, end_at, meta")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (String(error.message ?? "").includes("assistant_goals")) return null;
      throw error;
    }
    if (!goal) return null;

    const { data: state } = await supabase
      .from("assistant_goal_state")
      .select("target_count, progress_count")
      .eq("goal_id", (goal as any).id)
      .maybeSingle();

    return {
      id: (goal as any).id,
      kind: (goal as any).kind,
      title: (goal as any).title,
      status: (goal as any).status,
      endAt: (goal as any).end_at,
      targetCount: Number((state as any)?.target_count ?? (goal as any)?.meta?.targetCount ?? 0),
      progressCount: Number((state as any)?.progress_count ?? 0),
      listId: (goal as any)?.meta?.listId ?? null,
    };
  } catch {
    return null;
  }
}

export async function toolPlaybookEnd(supabase: any, userId: string) {
  try {
    const { error } = await supabase.from("assistant_memory").delete().eq("user_id", userId).eq("key", "active_goal");
    if (error && String(error.message ?? "").includes("assistant_memory")) {
      // schema missing -> ignore
    }
  } catch {
    // ignore
  }

  // Also end the v3 goal if present (best-effort).
  try {
    const mem = await getAssistantMemoryValue(supabase, userId, "active_goal_id");
    if (mem?.goalId) {
      await supabase
        .from("assistant_goals")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", String(mem.goalId))
        .eq("user_id", userId);
    }
    await setAssistantMemoryValue(supabase, userId, "active_goal_id", null);
  } catch {
    // ignore
  }
  return { ended: true };
}

// For now, we keep playbook_start as a tool implemented in the executor (it needs DB reads + optional LLM).
// This keeps playbooks composable: the orchestrator can emit a playbook_start action without hardcoding details.
export async function toolPlaybookStartWeeklyWatchPlan(supabase: any, userId: string) {
  // Build from recent likes (works even without OpenRouter).
  const likes = await getRecentLikes(supabase, userId, 8);

  // Load a few title names for copy generation.
  let likedNames: string[] = [];
  try {
    const ids = likes.map((x) => x.titleId).slice(0, 4);
    if (ids.length) {
      const { data, error } = await supabase.from("media_items").select("id, name").in("id", ids);
      if (!error && Array.isArray(data)) {
        const byId = new Map<string, string>();
        (data as any[]).forEach((it) => {
          if (it?.id && it?.name) byId.set(String(it.id), String(it.name));
        });
        likedNames = ids.map((id) => byId.get(id)).filter(Boolean) as string[];
      }
    }
  } catch {
    // ignore
  }

  const planned = await planWatchPlanCopy(likedNames);
  const name = (planned?.listName ?? "Weekly plan").trim() || "Weekly plan";
  const description = (planned?.description ?? "Auto-built from your likes").trim();

  const createdAt = new Date().toISOString();
  const created = await toolCreateList(supabase, userId, {
    name,
    description,
    isPublic: false,
    items: likes.map((x) => ({ titleId: x.titleId, contentType: x.kind })),
  });

  // Persist active goal best-effort.
  try {
    await supabase.from("assistant_memory").upsert(
      {
        user_id: userId,
        key: "active_goal",
        value: {
          playbookId: "weekly_watch_plan",
          startedAt: createdAt,
          listId: (created as any).listId,
          step: "list_created",
        },
        updated_at: createdAt,
      },
      { onConflict: "user_id,key" },
    );
  } catch {
    // ignore
  }

  // Step 8: also create a long-horizon goal (best-effort).
  // This lets the assistant show progress and run end-of-day recaps.
  try {
    await toolGoalStart(supabase, userId, {
      kind: "weekly_watch_count",
      title: "Weekly watch goal",
      targetCount: 3,
      days: 7,
      listId: (created as any).listId,
    });
  } catch {
    // ignore
  }

  return {
    ...(created as any),
    playbookId: "weekly_watch_plan",
    shareMessage: planned?.shareMessage ?? `I made a watch plan: /lists/${(created as any).listId}`,
  };
}

// -----------------------------------------------------------------------------
// Execution entrypoint
// -----------------------------------------------------------------------------
export async function executeAssistantTool(supabase: any, userId: string, call: AssistantToolCall): Promise<AssistantToolResult> {
  const tool = call.tool;
  const args = call.args ?? {};

  switch (tool) {
    case "get_recent_likes": {
      const limit = Number((args as any).limit ?? 8);
      const likes = await getRecentLikes(supabase, userId, Number.isFinite(limit) ? limit : 8);
      return { ok: true, tool, result: likes };
    }
    case "plan_watch_plan_copy": {
      const names = Array.isArray((args as any).likedTitleNames) ? ((args as any).likedTitleNames as any[]) : [];
      const planned = await planWatchPlanCopy(names.map((x) => String(x)).slice(0, 6));
      return { ok: true, tool, result: planned ?? null };
    }
    case "create_list": {
      const r = await toolCreateList(supabase, userId, args);
      return { ok: true, tool, result: r, navigateTo: (r as any).navigateTo ?? null };
    }
    case "list_add_item": {
      const r = await toolListAddItem(supabase, userId, args);
      return { ok: true, tool, result: r, navigateTo: (r as any).navigateTo ?? null };
    }
    case "diary_set_status": {
      const r = await toolDiarySetStatus(supabase, userId, args);
      return { ok: true, tool, result: r };
    }
    case "message_send": {
      const r = await toolMessageSend(supabase, userId, args);
      return { ok: true, tool, result: r, navigateTo: (r as any).navigateTo ?? null };
    }
    case "playbook_end": {
      const r = await toolPlaybookEnd(supabase, userId);
      return { ok: true, tool, result: r };
    }
    case "playbook_start": {
      const playbookId = coerceString((args as any).playbookId);
      if (playbookId !== "weekly_watch_plan") throw new Error("Unknown playbook");
      const r = await toolPlaybookStartWeeklyWatchPlan(supabase, userId);
      return { ok: true, tool, result: r, navigateTo: (r as any).navigateTo ?? null };
    }
    case "goal_start": {
      const r = await toolGoalStart(supabase, userId, args);
      return { ok: true, tool, result: r };
    }
    case "goal_end": {
      const r = await toolGoalEnd(supabase, userId, args);
      return { ok: true, tool, result: r };
    }
    case "goal_get_active": {
      const r = await toolGoalGetActive(supabase, userId);
      return { ok: true, tool, result: r };
    }
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
