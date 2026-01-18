// supabase/functions/assistant-chat-reply/lib/tools.ts
//
// Tool-call preparation + execution helpers extracted from index.ts.
// Intentionally behavior-preserving.

import {
  executeAssistantTool,
  type AssistantToolCall,
  type AssistantToolResult,
} from "../../_shared/assistantTools.ts";
import { normalizeToolArgs } from "../../_shared/assistantToolArgs.ts";

export type MiniRow = [number, string, string];

const WRITE_TOOLS = new Set<string>([
  "plan_execute",
  "create_list",
  "list_add_item",
  "list_add_items",
  "list_remove_item",
  "list_set_visibility",
  "rate_title",
  "review_upsert",
  "follow_user",
  "unfollow_user",
  "block_user",
  "unblock_user",
  "notifications_mark_read",
  "conversation_mute",
  "diary_set_status",
  "message_send",
  "playbook_start",
  "playbook_end",
  "goal_start",
  "goal_end",
]);

function coerceArgString(x: unknown): string {
  return typeof x === "string" ? x : String(x ?? "");
}

export async function execAndLogTool(
  ctx: {
    supabaseAuth: any;
    userId: string;
    conversationId: string;
    anchorMessageId: string | null;
    evidenceHandles: string[];
    toolTrace: any[];
    mini: MiniRow[];
    requestId?: string;
    runnerJobId?: string;
  },
  call: AssistantToolCall,
): Promise<AssistantToolResult | null> {
  const t0Tool = Date.now();
  const r = await executeAssistantTool(ctx.supabaseAuth, ctx.userId, call);
  const durationMs = Date.now() - t0Tool;
  ctx.toolTrace.push({ call, result: r });

  const handleId = ctx.anchorMessageId
    ? await tryLogToolResult(ctx.supabaseAuth, {
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      messageId: ctx.anchorMessageId,
      tool: call.tool,
      args: call.args ?? null,
      result: (r as any)?.result ?? r,
      requestId: ctx.requestId,
      runnerJobId: ctx.runnerJobId,
      durationMs,
    })
    : null;
  if (handleId) ctx.evidenceHandles.push(handleId);

  ctx.mini.push([
    (r as any)?.ok ? 1 : 0,
    String(call.tool),
    summarizeToolResult(String(call.tool), (r as any)?.result ?? r),
  ]);
  return r;
}

export async function maybePrepareToolCall(args?: {
  supabaseAuth: any;
  userId: string;
  conversationId: string;
  anchorMessageId: string | null;
  call?: AssistantToolCall;
  evidenceHandles: string[];
  toolTrace: any[];
  mini: MiniRow[];
  requestId?: string;
  runnerJobId?: string;
}): Promise<AssistantToolCall | null> {
  if (!args || !args.call || typeof args.call !== "object") return null;
  const tool = String(args.call.tool ?? "");
  const callArgs: any = normalizeToolArgs(
    tool,
    args.call.args && typeof args.call.args === "object" ? { ...(args.call.args as any) } : {},
  );

  // plan_execute is a meta-tool; resolution is handled inside the tool itself.
  if (tool === "plan_execute") return { tool: tool as any, args: callArgs };

  // If it's not a write tool, pass through untouched.
  if (!WRITE_TOOLS.has(tool)) return { tool: tool as any, args: callArgs };

  const ctx = {
    supabaseAuth: args.supabaseAuth,
    userId: args.userId,
    conversationId: args.conversationId,
    anchorMessageId: args.anchorMessageId,
    evidenceHandles: args.evidenceHandles,
    toolTrace: args.toolTrace,
    mini: args.mini,
    requestId: args.requestId,
    runnerJobId: args.runnerJobId,
  };

  // --- Title resolution (rate/review/diary) ---
  const needsTitleId = tool === "rate_title" || tool === "review_upsert" || tool === "diary_set_status";
  if (needsTitleId && !callArgs.titleId) {
    const q =
      coerceArgString(callArgs.titleQuery || callArgs.title || callArgs.query || callArgs.name).trim();
    if (!q) return null;

    const rr = await execAndLogTool(ctx, {
      tool: "resolve_title" as any,
      args: {
        query: q,
        year: callArgs.year ?? null,
        kind: callArgs.kind ?? callArgs.contentType ?? "",
        limit: 10,
      },
    });

    const best = (rr as any)?.result?.best;
    const conf = Number((rr as any)?.result?.confidence ?? 0);
    if (best?.id && conf >= 0.8) {
      callArgs.titleId = best.id;
      // Preserve original query (helps model explain what it did)
      callArgs.titleQuery = q;
    } else {
      return null;
    }
  }

  // --- List resolution ---
  const needsListId = tool.startsWith("list_") && tool !== "list_set_visibility" ? true : tool === "list_set_visibility";
  if (needsListId && !callArgs.listId) {
    const q = coerceArgString(callArgs.listQuery || callArgs.listName || callArgs.query).trim();
    if (q) {
      const rr = await execAndLogTool(ctx, {
        tool: "resolve_list" as any,
        args: { query: q, limit: 10 },
      });
      const best = (rr as any)?.result?.best;
      const conf = Number((rr as any)?.result?.confidence ?? 0);
      if (best?.id && conf >= 0.8) {
        callArgs.listId = best.id;
        callArgs.listQuery = q;
      } else {
        return null;
      }
    }
  }

  // --- TitleIds resolution for list_add_item(s) ---
  if ((tool === "list_add_item" || tool === "list_add_items") && !callArgs.titleId && !Array.isArray(callArgs.titleIds)) {
    const q = coerceArgString(callArgs.titleQuery || callArgs.title || callArgs.query).trim();
    if (q) {
      const rr = await execAndLogTool(ctx, {
        tool: "resolve_title" as any,
        args: { query: q, year: callArgs.year ?? null, kind: callArgs.kind ?? callArgs.contentType ?? "", limit: 10 },
      });
      const best = (rr as any)?.result?.best;
      const conf = Number((rr as any)?.result?.confidence ?? 0);
      if (best?.id && conf >= 0.8) {
        callArgs.titleId = best.id;
        callArgs.titleQuery = q;
      } else {
        return null;
      }
    }
  }

  if (tool === "list_add_items" && (!Array.isArray(callArgs.titleIds) || callArgs.titleIds.length === 0)) {
    const queries: string[] = Array.isArray(callArgs.titleQueries)
      ? callArgs.titleQueries.map((x: any) => coerceArgString(x).trim()).filter(Boolean)
      : [];
    if (queries.length) {
      const outIds: string[] = [];
      const max = Math.max(1, Math.min(8, Number(callArgs.max ?? queries.length)));
      for (const q of queries.slice(0, max)) {
        const rr = await execAndLogTool(ctx, { tool: "resolve_title" as any, args: { query: q, limit: 8 } });
        const best = (rr as any)?.result?.best;
        const conf = Number((rr as any)?.result?.confidence ?? 0);
        if (best?.id && conf >= 0.8) outIds.push(best.id);
      }
      if (!outIds.length) return null;
      callArgs.titleIds = outIds;
    }
  }

  // --- User resolution for social tools ---
  const needsTargetUser = tool === "follow_user" || tool === "unfollow_user" || tool === "block_user" || tool === "unblock_user";
  if (needsTargetUser && !callArgs.targetUserId) {
    const q = coerceArgString(callArgs.userQuery || callArgs.username || callArgs.query).trim();
    if (!q) return null;
    const rr = await execAndLogTool(ctx, { tool: "resolve_user" as any, args: { query: q, limit: 8 } });
    const best = (rr as any)?.result?.best;
    const conf = Number((rr as any)?.result?.confidence ?? 0);
    if (best?.id && conf >= 0.8) {
      callArgs.targetUserId = best.id;
      callArgs.userId = best.id;
      callArgs.userQuery = q;
    } else {
      return null;
    }
  }

  return { tool: tool as any, args: callArgs };
}

export async function maybeVerifyAfterWrite(args: {
  supabaseAuth: any;
  userId: string;
  conversationId: string;
  anchorMessageId: string | null;
  call: AssistantToolCall;
  writeResult: any;
  requestId?: string;
  runnerJobId?: string;
}): Promise<{ call: AssistantToolCall; result: AssistantToolResult; durationMs: number } | null> {
  try {
    const tool = String(args.call.tool ?? "");
    const a: any = args.call.args ?? {};

    if (tool === "rate_title" && a?.titleId) {
      const call = { tool: "get_my_rating" as any, args: { titleId: a.titleId } };
      const t0Tool = Date.now();
      const result = await executeAssistantTool(args.supabaseAuth, args.userId, call);
      const durationMs = Date.now() - t0Tool;
      return { call, result, durationMs };
    }
    if (tool === "review_upsert" && a?.titleId) {
      const call = { tool: "get_my_review" as any, args: { titleId: a.titleId } };
      const t0Tool = Date.now();
      const result = await executeAssistantTool(args.supabaseAuth, args.userId, call);
      const durationMs = Date.now() - t0Tool;
      return { call, result, durationMs };
    }
    if ((tool.startsWith("list_") || tool === "create_list") && (a?.listId || args.writeResult?.listId)) {
      const listId = coerceArgString(a.listId || args.writeResult?.listId);
      if (listId) {
        const call = { tool: "get_list_items" as any, args: { listId, limit: 12 } };
        const t0Tool = Date.now();
        const result = await executeAssistantTool(args.supabaseAuth, args.userId, call);
        const durationMs = Date.now() - t0Tool;
        return { call, result, durationMs };
      }
    }

    if (["follow_user", "unfollow_user", "block_user", "unblock_user"].includes(tool)) {
      const targetUserId = coerceArgString(a?.targetUserId ?? a?.userId ?? args.writeResult?.userId).trim();
      if (targetUserId) {
        const call = { tool: "get_relationship_status" as any, args: { targetUserId } };
        const t0Tool = Date.now();
        const result = await executeAssistantTool(args.supabaseAuth, args.userId, call);
        const durationMs = Date.now() - t0Tool;
        return { call, result, durationMs };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function tryLogToolResult(
  supabaseAuth: any,
  args: {
    userId: string;
    conversationId: string;
    messageId: string;
    tool: string;
    args: unknown;
    result: unknown;
    requestId?: string;
    runnerJobId?: string;
    durationMs?: number;
  },
): Promise<string | null> {
  try {
    const actionId = `tool_${crypto.randomUUID()}`;
    const payload = {
      tool: args.tool,
      args: args.args,
      meta: {
        requestId: args.requestId ?? null,
        runnerJobId: args.runnerJobId ?? null,
        durationMs: typeof args.durationMs === "number" ? args.durationMs : null,
      },
      // Guard rail: prevent truly massive payloads from being stored.
      // (jsonb can be large, but we don't want to blow up writes.)
      result: truncateDeep(args.result, 0),
    };

    const { error: logErr } = await supabaseAuth.from("assistant_message_action_log").insert({
      user_id: args.userId,
      conversation_id: args.conversationId,
      message_id: args.messageId,
      action_id: actionId,
      action_type: `tool_result:${args.tool}`,
      payload,
    });

    if (logErr) throw logErr;

    return actionId;
  } catch {
    // ignore if migration not applied / RLS denies / etc.
    return null;
  }
}

function truncateDeep(v: any, depth: number): any {
  if (depth > 3) return null;

  if (v == null) return v;

  if (typeof v === "string") {
    return v.length > 800 ? v.slice(0, 800) + "…" : v;
  }

  if (typeof v === "number" || typeof v === "boolean") return v;

  if (Array.isArray(v)) {
    const out = v.slice(0, 20).map((x) => truncateDeep(x, depth + 1));
    return out;
  }

  if (typeof v === "object") {
    const keys = Object.keys(v).slice(0, 30);
    const o: Record<string, any> = {};
    for (const k of keys) o[k] = truncateDeep((v as any)[k], depth + 1);
    return o;
  }

  return String(v);
}

export function summarizeToolResult(tool: string, result: any): string {
  try {
    if (result?.ok === false) {
      return String(result.token ?? result.code ?? "TOOL_ERROR");
    }
    const t = String(tool);
    if (t === "schema_summary") {
      const n = Array.isArray(result?.resources) ? result.resources.length : 0;
      return `Schema: ${n} resources`;
    }
    if (t === "db_read") {
      const res = String(result?.resource ?? "");
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const n = rows.length;
      const media = Array.isArray(result?.media) ? result.media : [];
      const sample = media.slice(0, 3).map((m: any) => String(m?.title ?? "").trim()).filter(Boolean);
      const sampleStr = sample.length ? `; e.g. ${sample.join(" | ")}` : "";
      return `${res || "db"}: ${n} rows${sampleStr}`;
    }
    if (t === "get_trending") {
      const items = (result?.items ?? result?.trending ?? result?.result ?? result) as any;
      const arr = Array.isArray(items) ? items : [];
      const n = arr.length;
      const sample = arr
        .slice(0, 5)
        .map((it: any) => {
          const id = String(it?.id ?? it?.titleId ?? "").trim();
          const title = String(it?.title ?? it?.name ?? "").trim();
          const rd = String(it?.releaseDate ?? it?.release_date ?? "").trim();
          const year = rd && rd.length >= 4 ? rd.slice(0, 4) : "";
          return [id, title, year].filter(Boolean).join(" | ");
        })
        .filter(Boolean)
        .join("; ");
      return sample ? `Trending: ${n} | ${sample}` : `Trending: ${n}`;
    }
    if (t === "get_recommendations") {
      const items = (result?.items ?? result?.recommendations ?? result?.result ?? result) as any;
      const arr = Array.isArray(items) ? items : [];
      const n = arr.length;
      const sample = arr
        .slice(0, 5)
        .map((it: any) => {
          const id = String(it?.id ?? it?.titleId ?? "").trim();
          const title = String(it?.title ?? it?.name ?? "").trim();
          const rd = String(it?.releaseDate ?? it?.release_date ?? "").trim();
          const year = rd && rd.length >= 4 ? rd.slice(0, 4) : "";
          return [id, title, year].filter(Boolean).join(" | ");
        })
        .filter(Boolean)
        .join("; ");
      return sample ? `Recommendations: ${n} | ${sample}` : `Recommendations: ${n}`;
    }
    if (t === "search_catalog" || t === "search_my_library") {
      const items = (result?.items ?? result?.results ?? result?.result ?? result) as any;
      const arr = Array.isArray(items) ? items : [];
      const n = arr.length;
      const sample = arr
        .slice(0, 5)
        .map((it: any) => {
          const id = String(it?.id ?? it?.titleId ?? "").trim();
          const title = String(it?.title ?? it?.name ?? "").trim();
          const rd = String(it?.releaseDate ?? it?.release_date ?? "").trim();
          const year = rd && rd.length >= 4 ? rd.slice(0, 4) : "";
          return [id, title, year].filter(Boolean).join(" | ");
        })
        .filter(Boolean)
        .join("; ");
      return sample ? `Results: ${n} | ${sample}` : `Results: ${n}`;
    }
    if (t === "resolve_title") {
      const best = result?.best ?? result?.result?.best;
      if (best?.id) return `Resolved: ${best.id}`;
      return "Resolved";
    }
    if (t === "resolve_list") {
      const best = result?.best ?? result?.result?.best;
      if (best?.id) return `Resolved list: ${best.id}`;
      return "Resolved list";
    }
    if (t === "resolve_user") {
      const best = result?.best ?? result?.result?.best;
      if (best?.id) return `Resolved user: ${best.id}`;
      return "Resolved user";
    }
    if (t === "get_my_library") {
      const items = (result?.items ?? result?.entries ?? result?.result ?? result) as any;
      const arr = Array.isArray(items) ? items : [];
      return `Library: ${arr.length}`;
    }
    if (t === "get_list_items") {
      const items = (result?.items ?? result?.rows ?? result?.result ?? result) as any;
      const arr = Array.isArray(items) ? items : [];
      return `List items: ${arr.length}`;
    }
    if (t === "create_list") {
      const id = result?.listId ?? result?.id;
      return id ? `List created: ${id}` : "List created";
    }
    if (t === "list_add_item" || t === "list_add_items") {
      return "Added to list";
    }
    if (t === "list_remove_item") {
      return "Removed from list";
    }
    if (t === "list_set_visibility") {
      return result?.isPublic ? "List is public" : "List is private";
    }
    if (t === "rate_title") {
      const r = result?.rating;
      return r != null ? `Rated: ${r}` : "Rated";
    }
    if (t === "review_upsert") {
      return result?.created ? "Review created" : result?.updated ? "Review updated" : "Review saved";
    }
    if (t === "follow_user") return "Followed";
    if (t === "unfollow_user") return "Unfollowed";
    if (t === "block_user") return "Blocked";
    if (t === "unblock_user") return "Unblocked";
    if (t === "notifications_mark_read") return "Notifications marked read";
    if (t === "conversation_mute") return "Muted";
    if (t === "diary_set_status") {
      const s = String(result?.status ?? "").trim();
      return s ? `Status: ${s}` : "Updated status";
    }
    if (t === "message_send") {
      return "Message sent";
    }
    if (t === "goal_start") return "Goal started";
    if (t === "goal_end") return "Goal ended";
    if (t === "goal_get_active") return result ? "Has active goal" : "No active goal";
    return "Done";
  } catch {
    return "Done";
  }
}
