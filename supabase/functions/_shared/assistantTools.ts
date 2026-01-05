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
import { log } from "./logger.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export type AssistantContentType = "movie" | "series" | "anime";

export type AssistantToolName =
  | "plan_execute"
  | "schema_summary"
  | "db_read"
  | "create_list"
  | "list_add_item"
  | "list_add_items"
  | "list_remove_item"
  | "list_set_visibility"
  | "rate_title"
  | "review_upsert"
  | "follow_user"
  | "unfollow_user"
  | "block_user"
  | "unblock_user"
  | "notifications_mark_read"
  | "conversation_mute"
  | "diary_set_status"
  | "message_send"
  | "playbook_start"
  | "playbook_end"
  | "goal_start"
  | "goal_end"
  | "goal_get_active"
  // Read-only helper tools (safe):
  | "get_recent_likes"
  | "plan_watch_plan_copy"
  | "get_my_profile"
  | "get_my_stats"
  | "get_my_lists"
  | "get_list_items"
  | "get_my_library"
  | "search_catalog"
  | "search_my_library"
  | "get_my_recent_activity"
  | "get_tool_result"
  | "get_trending"
  | "get_recommendations"
  | "resolve_title"
  | "resolve_list"
  | "resolve_user"
  | "get_relationship_status"
  | "get_my_rating"
  | "get_my_review"
  | "get_ctx_snapshot"
  // Internal-only rollback helpers (not exposed to the model):
  | "list_delete"
  | "rating_delete"
  | "review_delete";

export type AssistantToolCall = {
  tool: AssistantToolName;
  args?: Record<string, unknown>;
};

export type AssistantToolSuccess = {
  ok: true;
  tool: AssistantToolName;
  result?: unknown;
  navigateTo?: string | null;
  meta?: Record<string, unknown>;
};

export type AssistantToolError = {
  ok: false;
  tool: AssistantToolName;
  code: string;
  message: string;
  error?: string;
  token?: string;
  meta?: Record<string, unknown>;
};

export type AssistantToolResult = AssistantToolSuccess | AssistantToolError;

// -----------------------------------------------------------------------------
// Tool argument validation (Zod)
// -----------------------------------------------------------------------------

const zUuid = z.string().uuid();
const zContentType = z.enum(["movie", "series", "anime"]);
const zRating = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
  z.number().min(0).max(10).refine((n) => Math.round(n * 2) / 2 === n, { message: "rating must be in 0.5 steps" }),
);

const TOOL_ARG_SCHEMAS: Partial<Record<AssistantToolName, z.ZodTypeAny>> = {
  create_list: z.object({
    name: z.string().min(1),
    description: z.string().max(2000).optional(),
    isPublic: z.boolean().optional(),
    items: z
      .array(
        z.object({
          titleId: zUuid,
          contentType: zContentType,
          note: z.string().max(500).optional(),
        }),
      )
      .max(50)
      .optional(),
  }),

  list_add_item: z.object({
    listId: zUuid,
    titleId: zUuid,
    contentType: zContentType,
    note: z.string().max(500).optional(),
  }),

  list_add_items: z
    .object({
      listId: zUuid,
      items: z
        .array(
          z.object({
            titleId: zUuid,
            contentType: zContentType.optional(),
            note: z.string().max(500).optional(),
          }),
        )
        .min(1)
        .max(50)
        .optional(),
      titleIds: z.array(zUuid).min(1).max(50).optional(),
      contentType: zContentType.optional(),
      note: z.string().max(500).optional(),
    })
    .refine((value) => (Array.isArray(value.items) && value.items.length > 0) || (Array.isArray(value.titleIds) && value.titleIds.length > 0), {
      message: "items or titleIds required",
      path: ["items"],
    }),

  list_remove_item: z.object({
    listId: zUuid,
    titleId: zUuid,
  }),

  list_set_visibility: z.object({
    listId: zUuid,
    isPublic: z.boolean(),
  }),

  diary_set_status: z.object({
    titleId: zUuid,
    contentType: zContentType,
    status: z.enum(["want_to_watch", "watching", "watched", "dropped"]),
  }),

  rate_title: z.object({
    titleId: zUuid,
    contentType: zContentType,
    rating: zRating,
    comment: z.string().max(2000).optional(),
  }),

  review_upsert: z.object({
    titleId: zUuid,
    contentType: zContentType,
    rating: zRating.optional(),
    headline: z.string().max(140).optional(),
    body: z.string().min(1).max(10000),
    spoiler: z.boolean().optional(),
  }),

  follow_user: z.object({
    targetUserId: zUuid,
  }),
  unfollow_user: z.object({
    targetUserId: zUuid,
  }),
  block_user: z.object({
    targetUserId: zUuid,
  }),
  unblock_user: z.object({
    targetUserId: zUuid,
  }),

  conversation_mute: z.object({
    conversationId: zUuid,
    muted: z.boolean().optional(),
    mutedUntil: z.string().datetime().optional(),
  }),

  notifications_mark_read: z
    .object({
      ids: z.array(zUuid).max(50).optional(),
      all: z.boolean().optional(),
    })
    .partial(),

  message_send: z
    .object({
      text: z.string().min(1).max(5000),
      conversationId: zUuid.optional(),
      targetUserId: zUuid.optional(),
      // Optional idempotency key (client-supplied) to avoid duplicates.
      clientId: z.string().min(3).max(120).optional(),
      meta: z.record(z.any()).optional(),
    })
    .refine((x) => Boolean(x.conversationId) || Boolean(x.targetUserId), {
      message: "conversationId or targetUserId required",
      path: ["conversationId"],
    }),

  get_my_lists: z.object({ limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(50)).optional() }).partial(),
  get_list_items: z.object({ listId: zUuid, limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(200)).optional() }),
  get_my_library: z.object({ limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(50)).optional(), status: z.string().optional() }).partial(),
  search_catalog: z.object({ query: z.string().min(1).max(200), limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(20)).optional() }),
  search_my_library: z.object({ query: z.string().min(1).max(200), limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(50)).optional() }),
  get_trending: z.object({ mode: z.enum(["trending", "popular"]).optional(), limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(20)).optional() }).partial(),
  get_recommendations: z.object({ seedTitleId: zUuid.optional(), limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(20)).optional() }).partial(),
  resolve_title: z.object({ query: z.string().min(1).max(200) }),
  resolve_list: z.object({ query: z.string().min(1).max(200) }),
  resolve_user: z.object({ query: z.string().min(1).max(200) }),
};

function parseToolArgs(tool: AssistantToolName, args: unknown): Record<string, unknown> {
  const base = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
  const schema = TOOL_ARG_SCHEMAS[tool];
  if (!schema) return base;
  const parsed = schema.safeParse(base);
  if (parsed.success) return parsed.data as Record<string, unknown>;
  const issues = parsed.error.issues?.slice(0, 12) ?? [];
  throw new Error(`INVALID_ARGS:${JSON.stringify(issues)}`);
}

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

function inferToolToken(tool: AssistantToolName, code: string): string {
  if (code === "MISSING_QUERY") return "NO_QUERY";
  if (code === "NO_ACCESS") return "NO_ACCESS";

  if (tool.startsWith("list_") || tool === "create_list" || tool === "get_list_items") {
    return "NO_LIST_ACCESS";
  }

  if (
    tool === "diary_set_status" ||
    tool === "get_my_library" ||
    tool === "search_my_library" ||
    tool === "get_my_recent_activity" ||
    tool === "get_my_rating" ||
    tool === "get_my_review"
  ) {
    return "NO_LIBRARY_ACCESS";
  }

  if (tool === "search_catalog" || tool === "get_trending" || tool === "get_recommendations" || tool === "resolve_title") {
    return "NO_CATALOG_ACCESS";
  }

  return "TOOL_ERROR";
}

function normalizeToolError(tool: AssistantToolName, err: unknown): AssistantToolError {
  const rawMessage = err instanceof Error ? err.message : String(err ?? "Tool failed");
  let message = rawMessage;
  let code = "TOOL_ERROR";
  let invalidIssues: any[] | null = null;

  // Structured argument validation errors (from parseToolArgs)
  if (rawMessage.startsWith("INVALID_ARGS:")) {
    code = "INVALID_ARGS";
    message = "Invalid tool arguments";
    try {
      invalidIssues = JSON.parse(rawMessage.slice("INVALID_ARGS:".length)) as any[];
    } catch {
      invalidIssues = null;
    }
  }

  // Heuristic normalization for common errors.
  if (code === "TOOL_ERROR") {
    const lower = message.toLowerCase();
    if (lower.includes("missing query")) code = "MISSING_QUERY";
    else if (lower.includes("query required") || lower.includes("query is required")) code = "MISSING_QUERY";
    else if (lower.includes("missing listid") || lower.includes("list not found")) code = "NO_LIST_ACCESS";
    else if (lower.includes("missing titleid")) code = "MISSING_TITLE_ID";
    else if (lower.includes("missing conversationid")) code = "MISSING_CONVERSATION_ID";
    else if (lower.includes("missing user")) code = "MISSING_USER_ID";
    else if (lower.includes("no access") || lower.includes("forbidden")) code = "NO_ACCESS";

    if (code === "MISSING_QUERY") message = "Query required";
  }

  return {
    ok: false,
    tool,
    code,
    message,
    error: message,
    token: inferToolToken(tool, code),
    meta: {
      errorCode: (err as any)?.code ?? null,
      ...(invalidIssues ? { argIssues: invalidIssues } : {}),
    },
  };
}

function truncateDeep(v: any, depth: number): any {
  if (depth > 3) return null;
  if (v == null) return v;
  if (typeof v === "string") return v.length > 800 ? v.slice(0, 800) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => truncateDeep(x, depth + 1));
  if (typeof v === "object") {
    const keys = Object.keys(v).slice(0, 30);
    const o: Record<string, any> = {};
    for (const k of keys) o[k] = truncateDeep((v as any)[k], depth + 1);
    return o;
  }
  return String(v);
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
      // NOTE: the column is media_item_id (not title_id).
      .select("media_item_id, created_at")
      .eq("user_id", userId)
      .eq("event_type", "like")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(50, limit)));
    if (eventsError || !events || !Array.isArray(events) || events.length === 0) return [];

    const ids: string[] = [];
    for (const e of events as any[]) {
      const id = typeof e?.media_item_id === "string" ? e.media_item_id : null;
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

    const response_format = {
      type: "json_schema" as const,
      json_schema: {
        name: "MoviNestaWatchPlanCopy",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            listName: { type: "string" },
            description: { type: "string" },
            shareMessage: { type: "string" },
          },
          required: ["listName", "description", "shareMessage"],
        },
      },
    };

    const res = await openrouterChatWithFallback({
      models,
      max_tokens: 220,
      temperature: 0.7,
      response_format,
      plugins: [{ id: "response-healing" }],
      messages: [
        {
          role: "system",
          content:
            "You write short, punchy copy for a movie discovery app. Return ONLY JSON. No markdown. No emojis.",
        },
        {
          role: "user",
          content: JSON.stringify({
            liked: liked,
            constraints: { listNameMax: 28, descriptionMax: 80, shareMessageMax: 110 },
          }),
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
// More read-only DB helpers (for chat)
// -----------------------------------------------------------------------------

function pickMediaTitle(row: any): string {
  return (
    (typeof row?.tmdb_title === "string" && row.tmdb_title) ||
    (typeof row?.tmdb_name === "string" && row.tmdb_name) ||
    (typeof row?.omdb_title === "string" && row.omdb_title) ||
    (typeof row?.tmdb_original_title === "string" && row.tmdb_original_title) ||
    (typeof row?.tmdb_original_name === "string" && row.tmdb_original_name) ||
    "Untitled"
  );
}

function pickPosterUrl(row: any): string | null {
  // Prefer TMDB poster path when present, fall back to OMDb poster URL.
  const tmdb = typeof row?.tmdb_poster_path === "string" ? row.tmdb_poster_path : null;
  const omdb = typeof row?.omdb_poster === "string" ? row.omdb_poster : null;
  return tmdb || omdb || null;
}

export async function toolGetMyProfile(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,bio,created_at,updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function toolGetMyStats(supabase: any, userId: string) {
  // Use multiple lightweight COUNT queries (RLS-safe).
  const statuses = ["want_to_watch", "watching", "watched", "dropped"] as const;

  const out: Record<string, number> = {};
  let total = 0;
  for (const s of statuses) {
    const { count, error } = await supabase
      .from("library_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", s);
    if (error) throw new Error(error.message);
    const c = Number(count ?? 0);
    out[s] = Number.isFinite(c) ? c : 0;
    total += out[s];
  }

  const { count: listsCount, error: listsErr } = await supabase
    .from("lists")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (listsErr) throw new Error(listsErr.message);

  const { count: likesCount, error: likesErr } = await supabase
    .from("media_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "like");
  if (likesErr) throw new Error(likesErr.message);

  return {
    libraryTotal: total,
    libraryByStatus: out,
    listsCount: Number(listsCount ?? 0) || 0,
    likesCount: Number(likesCount ?? 0) || 0,
  };
}

// One-call context snapshot to reduce roundtrips and hallucinations.
// Reimplemented to use manual aggregation (Admin-client safe) instead of RPC (which needs exact auth.uid()).
export async function toolGetCtxSnapshot(supabase: any, userId: string, args: any) {
  const limit = Math.max(1, Math.min(20, Number(args?.limit ?? 8) || 8));

  try {
    const [profile, stats, lists, library] = await Promise.all([
      toolGetMyProfile(supabase, userId).catch(() => null),
      toolGetMyStats(supabase, userId).catch(() => ({ libraryTotal: 0, libraryByStatus: {}, listsCount: 0, likesCount: 0 })),
      // Just get a summary of recent lists
      toolGetMyLists(supabase, userId, { limit: 5 }).catch(() => []),
      // Just get a summary of recent library activity
      toolGetMyLibrary(supabase, userId, { limit: 5 }).catch(() => []),
    ]);

    return {
      ok: true,
      profile: profile ?? null,
      stats: stats ?? null,
      lists: Array.isArray(lists) ? lists : [],
      library: Array.isArray(library) ? library : [],
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// -----------------------------------------------------------------------------
// Schema-aware, read-only query tool (guarded)
// -----------------------------------------------------------------------------

type DbReadOp = "eq" | "ilike" | "in" | "gte" | "lte";
type DbReadWhere = Record<string, unknown | { op: DbReadOp; value: unknown }>;

type DbReadResourceSpec = {
  table: string;
  // Supabase select string (explicit, no wildcards).
  select: string;
  // Column used to scope to the current user (or null if scoped via ownership checks).
  userScopeCol?: string;
  // Apply additional ownership checks (e.g. list_items requires list belongs to user).
  needsListOwnership?: boolean;
  // Whether to attach media title snippets for title_id fields.
  attachMedia?: boolean;
  // Allowed filter columns (additional filters beyond user scope).
  filterable: string[];
  // Allowed order columns.
  orderable: string[];
  // Hard max rows.
  maxLimit: number;
};

const DB_READ_RESOURCES: Record<string, DbReadResourceSpec> = {
  ratings: {
    table: "ratings",
    select: "id,title_id,rating,created_at,updated_at",
    userScopeCol: "user_id",
    attachMedia: true,
    filterable: ["title_id", "rating", "created_at", "updated_at"],
    orderable: ["updated_at", "created_at", "rating"],
    maxLimit: 50,
  },
  reviews: {
    table: "reviews",
    select: "id,title_id,body,spoiler,created_at,updated_at",
    userScopeCol: "user_id",
    attachMedia: true,
    filterable: ["title_id", "created_at", "updated_at"],
    orderable: ["updated_at", "created_at"],
    maxLimit: 20,
  },
  library_entries: {
    table: "library_entries",
    select: "id,title_id,content_type,status,started_at,completed_at,updated_at",
    userScopeCol: "user_id",
    attachMedia: true,
    filterable: ["status", "content_type", "title_id", "updated_at"],
    orderable: ["updated_at", "created_at"],
    maxLimit: 50,
  },
  lists: {
    table: "lists",
    select: "id,name,description,is_public,created_at,updated_at",
    userScopeCol: "user_id",
    filterable: ["is_public", "created_at", "updated_at", "name"],
    orderable: ["updated_at", "created_at", "name"],
    maxLimit: 50,
  },
  list_items: {
    table: "list_items",
    select: "id,list_id,title_id,content_type,position,note,created_at,updated_at",
    needsListOwnership: true,
    attachMedia: true,
    filterable: ["list_id", "title_id", "content_type", "created_at", "updated_at"],
    orderable: ["position", "updated_at", "created_at"],
    maxLimit: 80,
  },
  notifications: {
    table: "notifications",
    select: "id,type,body,created_at,read_at",
    userScopeCol: "user_id",
    filterable: ["type", "created_at", "read_at"],
    orderable: ["created_at", "read_at"],
    maxLimit: 50,
  },
  follows: {
    table: "follows",
    select: "follower_id,followed_id,created_at",
    userScopeCol: "follower_id",
    filterable: ["followed_id", "created_at"],
    orderable: ["created_at"],
    maxLimit: 80,
  },
  blocked_users: {
    table: "blocked_users",
    select: "blocker_id,blocked_id,created_at",
    userScopeCol: "blocker_id",
    filterable: ["blocked_id", "created_at"],
    orderable: ["created_at"],
    maxLimit: 80,
  },
  goals: {
    table: "assistant_goals",
    select: "id,kind,status,created_at,updated_at",
    userScopeCol: "user_id",
    filterable: ["kind", "status", "created_at", "updated_at"],
    orderable: ["updated_at", "created_at"],
    maxLimit: 30,
  },
};

export function toolSchemaSummary() {
  const resources = Object.entries(DB_READ_RESOURCES).map(([k, spec]) => ({
    resource: k,
    table: spec.table,
    filterable: spec.filterable,
    orderable: spec.orderable,
    maxLimit: spec.maxLimit,
    attachMedia: !!spec.attachMedia,
    notes: spec.needsListOwnership ? "Requires list ownership (list_id must be yours)." : null,
  }));

  return {
    resources,
    usage: {
      example: {
        resource: "ratings",
        where: { rating: { op: "gte", value: 8 } },
        orderBy: { col: "updated_at", asc: false },
        limit: 10,
        includeMedia: true,
      },
    },
  };
}

function isAllowedColumn(spec: DbReadResourceSpec, col: string): boolean {
  return spec.filterable.includes(col) || spec.orderable.includes(col);
}

function normalizeDbReadWhere(where: unknown): DbReadWhere {
  if (!where || typeof where !== "object" || Array.isArray(where)) return {};
  return where as DbReadWhere;
}

function applyWhere(q: any, spec: DbReadResourceSpec, where: DbReadWhere) {
  for (const [key, raw] of Object.entries(where)) {
    const col = String(key);
    if (!isAllowedColumn(spec, col)) continue;

    const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as any) : null;
    const op = (obj?.op ? String(obj.op) : "eq") as DbReadOp;
    const value = obj?.op ? obj.value : raw;

    if (value === undefined) continue;

    if (op === "eq") q = q.eq(col, value);
    else if (op === "ilike") {
      const s = String(value ?? "");
      const like = `%${s.replace(/%/g, "").slice(0, 80)}%`;
      q = q.ilike(col, like);
    } else if (op === "in") {
      const arr = Array.isArray(value) ? value : [value];
      q = q.in(col, arr);
    } else if (op === "gte") q = q.gte(col, value);
    else if (op === "lte") q = q.lte(col, value);
  }
  return q;
}

export async function toolDbRead(supabase: any, userId: string, args: any) {
  const resource = coerceString(args?.resource).trim();
  if (!resource) throw new Error("Missing resource");

  const spec = DB_READ_RESOURCES[resource];
  if (!spec) throw new Error("Unknown resource");

  const limit = Math.max(1, Math.min(spec.maxLimit, Number(args?.limit ?? 20) || 20));
  const includeMedia = Boolean(args?.includeMedia ?? spec.attachMedia);

  let q = supabase.from(spec.table).select(spec.select).limit(limit);

  // User scoping.
  if (spec.userScopeCol) {
    q = q.eq(spec.userScopeCol, userId);
  }

  // Ownership checks.
  if (spec.needsListOwnership) {
    const listId = coerceString(args?.listId ?? (args?.where as any)?.list_id ?? (args?.where as any)?.listId).trim();
    if (!listId) throw new Error("list_items requires listId");
    // Confirm list belongs to this user.
    const { data: list, error: listErr } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", userId)
      .maybeSingle();
    if (listErr) throw new Error(listErr.message);
    if (!list) throw new Error("List not found");
    q = q.eq("list_id", listId);
  }

  // Filters.
  const where = normalizeDbReadWhere(args?.where);
  q = applyWhere(q, spec, where);

  // Ordering.
  const orderBy = args?.orderBy && typeof args.orderBy === "object" ? (args.orderBy as any) : null;
  const orderCol = orderBy?.col ? String(orderBy.col) : null;
  const asc = orderBy?.asc === true;
  if (orderCol && spec.orderable.includes(orderCol)) {
    q = q.order(orderCol, { ascending: asc });
  } else if (spec.orderable.includes("updated_at")) {
    q = q.order("updated_at", { ascending: false });
  } else if (spec.orderable.includes("created_at")) {
    q = q.order("created_at", { ascending: false });
  }

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  const outRows = Array.isArray(rows) ? rows : [];

  // Optional media attachment for readability (kept compact).
  if (includeMedia && spec.attachMedia) {
    const ids = Array.from(
      new Set(
        outRows
          .map((r: any) => String(r?.title_id ?? r?.titleId ?? "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 60);
    let media: any[] = [];
    if (ids.length) {
      const { data: mi, error: miErr } = await supabase
        .from("media_items")
        .select("id,kind,tmdb_title,tmdb_name,omdb_title,tmdb_poster_path,omdb_poster")
        .in("id", ids);
      if (miErr) throw new Error(miErr.message);
      media = (Array.isArray(mi) ? mi : []).map((x: any) => ({
        id: x.id,
        kind: x.kind,
        title: pickMediaTitle(x),
        poster: pickPosterUrl(x),
      }));
    }
    return { resource, rows: outRows, media };
  }

  return { resource, rows: outRows };
}

export async function toolGetMyLists(supabase: any, userId: string, args: any) {
  const limit = Math.max(1, Math.min(50, Number(args?.limit ?? 20) || 20));
  const { data, error } = await supabase
    .from("lists")
    .select("id,name,description,is_public,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

export async function toolGetListItems(supabase: any, userId: string, args: any) {
  const listId = coerceString(args?.listId);
  const limit = Math.max(1, Math.min(100, Number(args?.limit ?? 40) || 40));
  if (!listId) throw new Error("Missing listId");

  // Ownership check.
  const { data: list, error: listErr } = await supabase
    .from("lists")
    .select("id,name,description,is_public")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (listErr) throw new Error(listErr.message);
  if (!list) throw new Error("List not found");

  const { data: rows, error: rowsErr } = await supabase
    .from("list_items")
    .select("id,title_id,content_type,position,note,created_at,updated_at")
    .eq("list_id", listId)
    .order("position", { ascending: true })
    .limit(limit);
  if (rowsErr) throw new Error(rowsErr.message);

  const ids = (Array.isArray(rows) ? rows : []).map((r: any) => String(r.title_id)).filter(Boolean);
  let itemsById = new Map<string, any>();
  if (ids.length) {
    const { data: mi, error: miErr } = await supabase
      .from("media_items")
      .select("id,kind,tmdb_title,tmdb_name,omdb_title,tmdb_poster_path,omdb_poster")
      .in("id", ids);
    if (miErr) throw new Error(miErr.message);
    (Array.isArray(mi) ? mi : []).forEach((x: any) => itemsById.set(String(x.id), x));
  }

  const out = (Array.isArray(rows) ? rows : []).map((r: any) => {
    const mi = itemsById.get(String(r.title_id));
    return {
      id: r.id,
      titleId: r.title_id,
      position: r.position,
      note: r.note,
      contentType: r.content_type,
      title: mi ? pickMediaTitle(mi) : null,
      kind: mi?.kind ?? null,
      poster: mi ? pickPosterUrl(mi) : null,
      createdAt: r.created_at,
    };
  });

  return { list, items: out };
}

export async function toolGetMyLibrary(supabase: any, userId: string, args: any) {
  const status = typeof args?.status === "string" ? String(args.status) : null;
  const limit = Math.max(1, Math.min(80, Number(args?.limit ?? 30) || 30));

  let q = supabase
    .from("library_entries")
    .select("id,title_id,content_type,status,notes,started_at,completed_at,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (status) q = q.eq("status", status);

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  const ids = (Array.isArray(rows) ? rows : []).map((r: any) => String(r.title_id)).filter(Boolean);
  let itemsById = new Map<string, any>();
  if (ids.length) {
    const { data: mi, error: miErr } = await supabase
      .from("media_items")
      .select("id,kind,tmdb_title,tmdb_name,omdb_title,tmdb_poster_path,omdb_poster")
      .in("id", ids);
    if (miErr) throw new Error(miErr.message);
    (Array.isArray(mi) ? mi : []).forEach((x: any) => itemsById.set(String(x.id), x));
  }

  const out = (Array.isArray(rows) ? rows : []).map((r: any) => {
    const mi = itemsById.get(String(r.title_id));
    return {
      id: r.id,
      titleId: r.title_id,
      status: r.status,
      contentType: r.content_type,
      title: mi ? pickMediaTitle(mi) : null,
      kind: mi?.kind ?? null,
      poster: mi ? pickPosterUrl(mi) : null,
      updatedAt: r.updated_at,
    };
  });

  return out;
}

export async function toolSearchCatalog(supabase: any, args: any) {
  const query = coerceString(args?.query ?? args?.q ?? args?.title ?? args?.text).trim();
  const limit = Math.max(1, Math.min(30, Number(args?.limit ?? 8) || 8));
  if (!query) return [];

  // Search across common title fields.
  const like = `%${query.replace(/%/g, "").slice(0, 80)}%`;

  const { data, error } = await supabase
    .from("media_items")
    .select("id,kind,tmdb_title,tmdb_name,omdb_title,tmdb_poster_path,omdb_poster,tmdb_release_date,tmdb_first_air_date")
    .or(`tmdb_title.ilike.${like},tmdb_name.ilike.${like},omdb_title.ilike.${like}`)
    .order("tmdb_popularity", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []).map((x: any) => ({
    id: x.id,
    kind: x.kind,
    title: pickMediaTitle(x),
    poster: pickPosterUrl(x),
    releaseDate: x.tmdb_release_date ?? x.tmdb_first_air_date ?? null,
  }));
}

// -----------------------------------------------------------------------------
// Resolution helpers (anti-hallucination)
// -----------------------------------------------------------------------------

function normalizeName(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTitleMatch(query: string, candidateTitle: string): number {
  const q = normalizeName(query);
  const c = normalizeName(candidateTitle);
  if (!q || !c) return 0;
  if (q === c) return 10;
  if (c.startsWith(q)) return 7;
  if (c.includes(q)) return 5;
  // very light token overlap score
  const qParts = new Set(q.split(" ").filter(Boolean));
  const cParts = new Set(c.split(" ").filter(Boolean));
  if (!qParts.size || !cParts.size) return 0;
  let overlap = 0;
  for (const w of qParts) if (cParts.has(w)) overlap++;
  return Math.min(4, overlap);
}

export async function toolResolveTitle(supabase: any, args: any) {
  // Be permissive about input shape (LLMs and older clients sometimes emit
  // `title` or `text` instead of `query`).
  const query = coerceString(
    args?.query ?? args?.title ?? args?.text ?? args?.name ?? args?.q,
  ).trim();
  const year = args?.year == null ? null : Number(args.year);
  const kind = typeof args?.kind === "string" ? args.kind.trim() : "";
  const limit = Math.max(1, Math.min(20, Number(args?.limit ?? 10) || 10));
  if (!query) {
    return {
      query: "",
      confidence: 0,
      best: null,
      needsDisambiguation: true,
      candidates: [],
      reason: "MISSING_QUERY",
    };
  }

  const candidates = await toolSearchCatalog(supabase, { query, limit });

  const scored = candidates
    .map((c: any) => {
      const s = scoreTitleMatch(query, c?.title ?? "");
      const y = typeof c?.releaseDate === "string" ? Number(String(c.releaseDate).slice(0, 4)) : null;
      const yearBoost = year && y && year === y ? 2 : 0;
      const kindBoost = kind && c?.kind && String(c.kind) === kind ? 0.5 : 0;
      return { ...c, score: s + yearBoost + kindBoost };
    })
    .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  const top = scored[0] ?? null;
  const second = scored[1] ?? null;

  const topScore = Number(top?.score ?? 0);
  const secondScore = Number(second?.score ?? 0);
  let confidence = 0;
  if (topScore >= 10) confidence = 0.95;
  else if (topScore >= 7 && topScore >= secondScore + 2) confidence = 0.88;
  else if (topScore >= 6 && topScore >= secondScore + 1) confidence = 0.8;
  else if (topScore >= 5 && topScore > secondScore) confidence = 0.72;
  else confidence = 0.55;

  const best = confidence >= 0.8 ? { id: top.id, title: top.title, kind: top.kind, releaseDate: top.releaseDate, poster: top.poster } : null;

  return {
    query,
    confidence,
    best,
    needsDisambiguation: !best,
    candidates: scored.map((c: any) => ({ id: c.id, title: c.title, kind: c.kind, releaseDate: c.releaseDate, poster: c.poster })),
  };
}

export async function toolResolveList(supabase: any, userId: string, args: any) {
  const query = coerceString(args?.query).trim();
  const limit = Math.max(1, Math.min(20, Number(args?.limit ?? 10) || 10));
  if (!query) throw new Error("Query required");

  const like = `%${query.replace(/%/g, "").slice(0, 80)}%`;
  const { data, error } = await supabase
    .from("lists")
    .select("id,name,description,is_public,updated_at")
    .eq("user_id", userId)
    .ilike("name", like)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = Array.isArray(data) ? data : [];
  const scored = rows
    .map((r: any) => ({
      ...r,
      score: scoreTitleMatch(query, r?.name ?? ""),
    }))
    .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  const top = scored[0] ?? null;
  const second = scored[1] ?? null;
  const topScore = Number(top?.score ?? 0);
  const secondScore = Number(second?.score ?? 0);
  let confidence = 0;
  if (topScore >= 10) confidence = 0.95;
  else if (topScore >= 7 && topScore >= secondScore + 2) confidence = 0.88;
  else if (topScore >= 6 && topScore >= secondScore + 1) confidence = 0.8;
  else if (topScore >= 5 && topScore > secondScore) confidence = 0.72;
  else confidence = 0.55;

  const best = confidence >= 0.8 ? { id: top.id, name: top.name, isPublic: top.is_public } : null;
  return {
    query,
    confidence,
    best,
    needsDisambiguation: !best,
    candidates: scored.map((r: any) => ({ id: r.id, name: r.name, isPublic: r.is_public })),
  };
}

export async function toolResolveUser(supabase: any, args: any) {
  const query = coerceString(args?.query).trim();
  const limit = Math.max(1, Math.min(15, Number(args?.limit ?? 8) || 8));
  if (!query) throw new Error("Query required");

  const like = `%${query.replace(/%/g, "").slice(0, 80)}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .or(`username.ilike.${like},display_name.ilike.${like}`)
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = Array.isArray(data) ? data : [];
  const scored = rows
    .map((r: any) => ({
      ...r,
      score:
        Math.max(
          scoreTitleMatch(query, r?.username ?? ""),
          scoreTitleMatch(query, r?.display_name ?? ""),
        ),
    }))
    .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  const top = scored[0] ?? null;
  const second = scored[1] ?? null;
  const topScore = Number(top?.score ?? 0);
  const secondScore = Number(second?.score ?? 0);
  let confidence = 0;
  if (topScore >= 10) confidence = 0.95;
  else if (topScore >= 7 && topScore >= secondScore + 2) confidence = 0.88;
  else if (topScore >= 6 && topScore >= secondScore + 1) confidence = 0.8;
  else if (topScore >= 5 && topScore > secondScore) confidence = 0.72;
  else confidence = 0.55;

  const best = confidence >= 0.8 ? { id: top.id, username: top.username, displayName: top.display_name, avatarUrl: top.avatar_url } : null;
  return {
    query,
    confidence,
    best,
    needsDisambiguation: !best,
    candidates: scored.map((r: any) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
    })),
  };
}

export async function toolGetMyRating(supabase: any, userId: string, args: any) {
  const titleId = coerceString(args?.titleId);
  if (!titleId) throw new Error("Missing titleId");
  const { data, error } = await supabase
    .from("ratings")
    .select("id,rating,comment,updated_at")
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function toolGetMyReview(supabase: any, userId: string, args: any) {
  const titleId = coerceString(args?.titleId);
  if (!titleId) throw new Error("Missing titleId");
  const { data, error } = await supabase
    .from("reviews")
    .select("id,headline,spoiler,rating,updated_at")
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}


export async function toolGetTrending(supabase: any, args: any) {
  const limit = Math.max(1, Math.min(30, Number(args?.limit ?? 10) || 10));
  const kind = typeof args?.kind === "string" ? args.kind.trim() : "";

  let q = supabase
    .from("media_items")
    .select(
      "id,kind,tmdb_title,tmdb_name,omdb_title,tmdb_poster_path,omdb_poster,tmdb_release_date,tmdb_first_air_date,tmdb_popularity",
    )
    .not("tmdb_popularity", "is", null)
    .order("tmdb_popularity", { ascending: false })
    .limit(limit);

  if (kind) {
    q = q.eq("kind", kind);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []).map((x: any) => ({
    id: x.id,
    kind: x.kind,
    title: pickMediaTitle(x),
    poster: pickPosterUrl(x),
    releaseDate: x.tmdb_release_date ?? x.tmdb_first_air_date ?? null,
    popularity: x.tmdb_popularity ?? null,
  }));
}

export async function toolGetRecommendations(supabase: any, userId: string, args: any) {
  const limit = Math.max(1, Math.min(30, Number(args?.limit ?? 10) || 10));
  const likes = await getRecentLikes(supabase, userId, Math.max(6, Math.min(20, Number(args?.seedLikes ?? 10) || 10)));
  const likedIds = likes.map((l) => String(l.titleId)).filter(Boolean);

  if (!likedIds.length) {
    // Fallback to trending if no taste signal.
    return await toolGetTrending(supabase, { limit });
  }

  // Pull genres from liked titles.
  const { data: likedItems, error: likedErr } = await supabase
    .from("media_items")
    .select("id,tmdb_genre_ids")
    .in("id", likedIds)
    .limit(50);
  if (likedErr) throw new Error(likedErr.message);

  const genreSet = new Set<number>();
  (Array.isArray(likedItems) ? likedItems : []).forEach((it: any) => {
    const ids = Array.isArray(it?.tmdb_genre_ids) ? (it.tmdb_genre_ids as any[]) : [];
    ids.forEach((g) => {
      const n = Number(g);
      if (Number.isFinite(n)) genreSet.add(n);
    });
  });

  const genres = Array.from(genreSet).slice(0, 25);
  if (!genres.length) {
    return await toolGetTrending(supabase, { limit });
  }

  // Find items that overlap those genres, excluding already-liked ids.
  const { data, error } = await supabase
    .from("media_items")
    .select(
      "id,kind,tmdb_title,tmdb_name,omdb_title,tmdb_poster_path,omdb_poster,tmdb_release_date,tmdb_first_air_date,tmdb_popularity,tmdb_vote_average",
    )
    .overlaps("tmdb_genre_ids", genres as any)
    .not("tmdb_popularity", "is", null)
    .not("id", "in", `(${likedIds.map((x) => `'${x}'`).join(",")})`)
    .order("tmdb_vote_average", { ascending: false, nullsFirst: false })
    .order("tmdb_popularity", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []).map((x: any) => ({
    id: x.id,
    kind: x.kind,
    title: pickMediaTitle(x),
    poster: pickPosterUrl(x),
    releaseDate: x.tmdb_release_date ?? x.tmdb_first_air_date ?? null,
    score: x.tmdb_vote_average ?? null,
  }));
}

export async function toolSearchMyLibrary(supabase: any, userId: string, args: any) {
  const query = coerceString(args?.query).trim();
  const limit = Math.max(1, Math.min(30, Number(args?.limit ?? 10) || 10));
  if (!query) throw new Error("Query required");

  // 1) Find matching titles in catalog (small set)
  const hits = await toolSearchCatalog(supabase, { query, limit: Math.max(limit, 6) });
  const ids = hits.map((h: any) => String(h.id)).filter(Boolean);
  if (!ids.length) return [];

  // 2) Check which ones exist in user's library
  const { data: rows, error } = await supabase
    .from("library_entries")
    .select("id,title_id,status,content_type,updated_at")
    .eq("user_id", userId)
    .in("title_id", ids)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const byId = new Map<string, any>();
  hits.forEach((h: any) => byId.set(String(h.id), h));

  return (Array.isArray(rows) ? rows : []).map((r: any) => {
    const hit = byId.get(String(r.title_id));
    return {
      id: r.id,
      titleId: r.title_id,
      status: r.status,
      contentType: r.content_type,
      title: hit?.title ?? null,
      poster: hit?.poster ?? null,
      updatedAt: r.updated_at,
    };
  });
}

export async function toolGetMyRecentActivity(supabase: any, userId: string, args: any) {
  const limit = Math.max(1, Math.min(40, Number(args?.limit ?? 15) || 15));
  const { data: events, error } = await supabase
    .from("media_events")
    .select("id,media_item_id,event_type,source,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const ids = (Array.isArray(events) ? events : []).map((e: any) => String(e.media_item_id)).filter(Boolean);
  let itemsById = new Map<string, any>();
  if (ids.length) {
    const { data: mi, error: miErr } = await supabase
      .from("media_items")
      .select("id,kind,tmdb_title,tmdb_name,omdb_title,tmdb_poster_path,omdb_poster")
      .in("id", ids);
    if (miErr) throw new Error(miErr.message);
    (Array.isArray(mi) ? mi : []).forEach((x: any) => itemsById.set(String(x.id), x));
  }

  return (Array.isArray(events) ? events : []).map((e: any) => {
    const mi = itemsById.get(String(e.media_item_id));
    return {
      id: e.id,
      eventType: e.event_type,
      createdAt: e.created_at,
      titleId: e.media_item_id,
      title: mi ? pickMediaTitle(mi) : null,
      kind: mi?.kind ?? null,
      poster: mi ? pickPosterUrl(mi) : null,
      source: e.source ?? null,
    };
  });
}

async function ensureTitleExists(supabase: any, titleId: string) {
  const { data, error } = await supabase
    .from("media_items")
    .select("id,kind")
    .eq("id", titleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Title not found");
  return data as any;
}

async function resolveContentType(
  supabase: any,
  titleId: string,
  contentType?: string | null,
): Promise<"movie" | "series" | "anime"> {
  const ct = (contentType ?? "").trim();
  if (ct === "movie" || ct === "series" || ct === "anime") return ct;
  const mi = await ensureTitleExists(supabase, titleId);
  const k = String((mi as any)?.kind ?? "");
  return inferContentTypeFromMediaKind(k);
}

function coerceRating(v: any): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error("Invalid rating");
  // DB constraint: 0..10 and increments of 0.5
  const rounded = Math.round(n * 2) / 2;
  if (Math.abs(rounded - n) > 1e-9) throw new Error("Rating must be in 0.5 steps");
  if (rounded < 0 || rounded > 10) throw new Error("Rating must be between 0 and 10");
  return rounded;
}

async function toolListAddItems(supabase: any, userId: string, args: any) {
  const listId = coerceString(args?.listId);
  const items = Array.isArray(args?.items) ? args.items : [];
  const itemMeta = new Map<string, { contentType: string | null; note: string | null }>();
  const idsFromItems: string[] = [];
  for (const item of items) {
    const tid = coerceString(item?.titleId);
    if (!tid) continue;
    idsFromItems.push(tid);
    itemMeta.set(tid, {
      contentType: typeof item?.contentType === "string" ? item.contentType : null,
      note: typeof item?.note === "string" ? item.note.slice(0, 200) : null,
    });
  }

  const idsFromArgs = Array.isArray(args?.titleIds) ? args.titleIds.map(coerceString).filter(Boolean) : [];
  const ids = idsFromItems.length ? idsFromItems : idsFromArgs;
  const contentTypeRaw = typeof args?.contentType === "string" ? args.contentType : null;
  const note = typeof args?.note === "string" ? args.note.slice(0, 200) : null;
  const max = Math.max(1, Math.min(30, Number(args?.max ?? (ids.length || 10))));
  if (!listId) throw new Error("Missing listId");
  if (!ids.length) throw new Error("Missing titleIds");

  // Ownership check
  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (listError) throw new Error(listError.message);
  if (!list) throw new Error("List not found");

  const titleIds = ids.slice(0, max);

  // Dedupe existing
  const { data: existing, error: exErr } = await supabase
    .from("list_items")
    .select("title_id")
    .eq("list_id", listId)
    .in("title_id", titleIds);
  if (exErr) throw new Error(exErr.message);
  const existingSet = new Set((existing ?? []).map((x: any) => x.title_id));

  const toInsert: string[] = titleIds.filter((id) => !existingSet.has(id));
  if (!toInsert.length) return { listId, added: 0, insertedTitleIds: [] };

  const { data: lastRow, error: lastError } = await supabase
    .from("list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw new Error(lastError.message);
  const basePos = Number((lastRow as any)?.position ?? 0);

  const now = new Date().toISOString();
  const rows: any[] = [];
  let pos = basePos;
  for (const tid of toInsert) {
    const item = itemMeta.get(tid);
    const ct = await resolveContentType(supabase, tid, item?.contentType ?? contentTypeRaw);
    pos += 1;
    rows.push({
      list_id: listId,
      title_id: tid,
      content_type: ct,
      position: pos,
      note: item?.note ?? note,
      created_at: now,
      updated_at: now,
    });
  }

  const { error: insErr } = await supabase.from("list_items").insert(rows);
  if (insErr) throw new Error(insErr.message);

  return { listId, added: rows.length, insertedTitleIds: toInsert };
}

async function toolListRemoveItem(supabase: any, userId: string, args: any) {
  const listId = coerceString(args?.listId);
  const itemId = coerceString(args?.itemId);
  const titleId = coerceString(args?.titleId);
  if (!listId) throw new Error("Missing listId");
  if (!itemId && !titleId) throw new Error("Provide itemId or titleId");

  // Ownership check
  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (listError) throw new Error(listError.message);
  if (!list) throw new Error("List not found");

  let q = supabase.from("list_items").delete().eq("list_id", listId);
  if (itemId) q = q.eq("id", itemId);
  if (titleId) q = q.eq("title_id", titleId);

  const { error } = await q;
  if (error) throw new Error(error.message);

  return { listId, removed: true };
}

async function toolListSetVisibility(supabase: any, userId: string, args: any) {
  const listId = coerceString(args?.listId);
  const isPublic = Boolean(args?.isPublic);
  if (!listId) throw new Error("Missing listId");

  const { data, error } = await supabase
    .from("lists")
    .update({ is_public: isPublic, updated_at: new Date().toISOString() })
    .eq("id", listId)
    .eq("user_id", userId)
    .select("id,is_public")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("List not found");

  return { listId, isPublic: (data as any).is_public };
}

async function toolRateTitle(supabase: any, userId: string, args: any) {
  const titleId = coerceString(args?.titleId);
  if (!titleId) throw new Error("Missing titleId");
  const rating = coerceRating(args?.rating);
  const comment = typeof args?.comment === "string" ? args.comment.slice(0, 400) : null;
  const contentType = await resolveContentType(supabase, titleId, args?.contentType);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("ratings")
    .upsert(
      {
        user_id: userId,
        title_id: titleId,
        content_type: contentType,
        rating,
        comment,
        updated_at: now,
      },
      { onConflict: "user_id,title_id" },
    )
    .select("id,rating,updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);

  return { titleId, rating: (data as any)?.rating ?? rating };
}

async function toolReviewUpsert(supabase: any, userId: string, args: any) {
  const titleId = coerceString(args?.titleId);
  if (!titleId) throw new Error("Missing titleId");
  const body = typeof args?.body === "string" ? args.body.trim().slice(0, 6000) : "";
  if (!body) throw new Error("Review body is required");
  const spoiler = Boolean(args?.spoiler ?? false);
  const headline = typeof args?.headline === "string" ? args.headline.trim().slice(0, 140) : null;
  const rating = args?.rating == null ? null : coerceRating(args?.rating);
  const contentType = await resolveContentType(supabase, titleId, args?.contentType);

  // Find an existing review (latest) for this user/title, update it; else insert.
  const { data: existing, error: exErr } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);

  const now = new Date().toISOString();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("reviews")
      .update({
        body,
        spoiler,
        headline,
        rating,
        content_type: contentType,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("id,updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { titleId, reviewId: (data as any)?.id ?? existing.id, updated: true };
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      user_id: userId,
      title_id: titleId,
      content_type: contentType,
      rating,
      headline,
      body,
      spoiler,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { titleId, reviewId: (data as any)?.id ?? null, created: true };
}

async function toolFollowUser(supabase: any, userId: string, args: any) {
  const targetUserId = coerceString(args?.targetUserId ?? args?.userId);
  if (!targetUserId) throw new Error("Missing userId");
  if (targetUserId === userId) throw new Error("Cannot follow yourself");
  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id: userId, followed_id: targetUserId }, { onConflict: "follower_id,followed_id" });
  if (error) throw new Error(error.message);
  return { userId: targetUserId, following: true };
}

async function toolUnfollowUser(supabase: any, userId: string, args: any) {
  const targetUserId = coerceString(args?.targetUserId ?? args?.userId);
  if (!targetUserId) throw new Error("Missing userId");
  const { error } = await supabase.from("follows").delete().eq("follower_id", userId).eq("followed_id", targetUserId);
  if (error) throw new Error(error.message);
  return { userId: targetUserId, following: false };
}

async function toolBlockUser(supabase: any, userId: string, args: any) {
  const targetUserId = coerceString(args?.targetUserId ?? args?.userId);
  if (!targetUserId) throw new Error("Missing userId");
  if (targetUserId === userId) throw new Error("Cannot block yourself");
  const { error } = await supabase
    .from("blocked_users")
    .upsert({ blocker_id: userId, blocked_id: targetUserId }, { onConflict: "blocker_id,blocked_id" });
  if (error) throw new Error(error.message);
  return { userId: targetUserId, blocked: true };
}

async function toolUnblockUser(supabase: any, userId: string, args: any) {
  const targetUserId = coerceString(args?.targetUserId ?? args?.userId);
  if (!targetUserId) throw new Error("Missing userId");
  const { error } = await supabase.from("blocked_users").delete().eq("blocker_id", userId).eq("blocked_id", targetUserId);
  if (error) throw new Error(error.message);
  return { userId: targetUserId, blocked: false };
}

async function toolGetRelationshipStatus(supabase: any, userId: string, args: any) {
  const targetUserId = coerceString(args?.targetUserId ?? args?.userId);
  if (!targetUserId) throw new Error("Missing userId");
  if (targetUserId === userId) {
    return { userId: targetUserId, following: false, blocked: false, self: true };
  }

  const [{ data: follow, error: fErr }, { data: block, error: bErr }] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", userId)
      .eq("followed_id", targetUserId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("blocked_users")
      .select("blocker_id")
      .eq("blocker_id", userId)
      .eq("blocked_id", targetUserId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (fErr) throw new Error(fErr.message);
  if (bErr) throw new Error(bErr.message);

  return { userId: targetUserId, following: Boolean(follow), blocked: Boolean(block) };
}

// Internal-only rollback helpers (not exposed to the model)
async function toolListDelete(supabase: any, userId: string, args: any) {
  const listId = coerceString(args?.listId);
  if (!listId) throw new Error("Missing listId");
  const { error } = await supabase.from("lists").delete().eq("id", listId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { listId, deleted: true };
}

async function toolRatingDelete(supabase: any, userId: string, args: any) {
  const titleId = coerceString(args?.titleId);
  if (!titleId) throw new Error("Missing titleId");
  const { error } = await supabase.from("ratings").delete().eq("user_id", userId).eq("title_id", titleId);
  if (error) throw new Error(error.message);
  return { titleId, deleted: true };
}

async function toolReviewDelete(supabase: any, userId: string, args: any) {
  const titleId = coerceString(args?.titleId);
  if (!titleId) throw new Error("Missing titleId");
  const { error } = await supabase.from("reviews").delete().eq("user_id", userId).eq("title_id", titleId);
  if (error) throw new Error(error.message);
  return { titleId, deleted: true };
}

async function toolNotificationsMarkRead(supabase: any, userId: string, args: any) {
  const ids = Array.isArray(args?.ids) ? args.ids.map(coerceString).filter(Boolean) : [];
  const all = Boolean(args?.all ?? false);
  let q = supabase.from("notifications").update({ is_read: true });
  q = q.eq("user_id", userId);
  if (!all) {
    if (!ids.length) throw new Error("Provide ids or set all=true");
    q = q.in("id", ids.slice(0, 50));
  }
  const { error } = await q;
  if (error) throw new Error(error.message);
  return { markedRead: true, all };
}

async function toolConversationMute(supabase: any, userId: string, args: any) {
  const conversationId = coerceString(args?.conversationId);
  if (!conversationId) throw new Error("Missing conversationId");
  const muted = Boolean(args?.muted ?? true);
  const mutedUntil = typeof args?.mutedUntil === "string" ? args.mutedUntil : null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("conversation_prefs")
    .upsert(
      {
        user_id: userId,
        conversation_id: conversationId,
        muted,
        muted_until: mutedUntil,
        updated_at: now,
      },
      { onConflict: "user_id,conversation_id" },
    )
    .select("muted,muted_until")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { conversationId, muted: (data as any)?.muted ?? muted, mutedUntil: (data as any)?.muted_until ?? mutedUntil };
}

async function toolGetToolResult(supabase: any, userId: string, args: any) {
  const actionId = coerceString(args?.actionId).trim();
  if (!actionId) throw new Error("Missing actionId");

  const { data, error } = await supabase
    .from("assistant_message_action_log")
    .select("action_id,action_type,created_at,payload")
    .eq("user_id", userId)
    .eq("action_id", actionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    actionId: data.action_id,
    actionType: data.action_type,
    createdAt: data.created_at,
    payload: truncateDeep((data as any).payload ?? null, 0),
  };
}

// -----------------------------------------------------------------------------
// Toolchains (multi-step) - Transactional plan execution
// -----------------------------------------------------------------------------
async function verifyTxOutputs(supabase: any, userId: string, outputs: any[]): Promise<{ ok: boolean; checks: any[] }> {
  try {
    const checks: any[] = [];
    const seen = new Set<string>();

    const push = (key: string, row: any) => {
      if (seen.has(key)) return;
      seen.add(key);
      checks.push(row);
    };

    for (const o of Array.isArray(outputs) ? outputs : []) {
      if (checks.length >= 3) break;
      const tool = String(o?.tool ?? "");

      if (tool === "rate_title") {
        const titleId = String(o?.titleId ?? "");
        if (!titleId) continue;
        const key = `rate:${titleId}`;
        const { data, error } = await supabase
          .from("ratings")
          .select("title_id,rating,updated_at")
          .eq("user_id", userId)
          .eq("title_id", titleId)
          .maybeSingle();
        push(key, { tool, titleId, ok: !error && !!data, rating: (data as any)?.rating ?? null });
        continue;
      }

      if (tool === "review_upsert") {
        const titleId = String(o?.titleId ?? "");
        if (!titleId) continue;
        const key = `review:${titleId}`;
        const { data, error } = await supabase
          .from("reviews")
          .select("id,title_id,updated_at")
          .eq("user_id", userId)
          .eq("title_id", titleId)
          .maybeSingle();
        push(key, { tool, titleId, ok: !error && !!data, reviewId: (data as any)?.id ?? null });
        continue;
      }

      if (tool === "create_list" || tool === "list_add_item" || tool === "list_add_items") {
        const listId = String(o?.listId ?? "");
        if (!listId) continue;
        const key = `list:${listId}`;
        const { count, error } = await supabase
          .from("list_items")
          .select("id", { count: "exact", head: true })
          .eq("list_id", listId);
        push(key, { tool, listId, ok: !error, itemsCount: Number(count ?? 0) || 0 });
        continue;
      }

      if (tool === "diary_set_status") {
        const titleId = String(o?.titleId ?? "");
        if (!titleId) continue;
        const key = `diary:${titleId}`;
        const { data, error } = await supabase
          .from("library_entries")
          .select("title_id,status,updated_at")
          .eq("user_id", userId)
          .eq("title_id", titleId)
          .maybeSingle();
        push(key, { tool, titleId, ok: !error && !!data, status: (data as any)?.status ?? null });
        continue;
      }

      if (tool === "follow_user" || tool === "unfollow_user" || tool === "block_user" || tool === "unblock_user") {
        const targetId = String(o?.targetId ?? "");
        if (!targetId) continue;
        const key = `rel:${targetId}`;
        const rel = await toolGetRelationshipStatus(supabase, userId, { userId: targetId });
        push(key, { tool, targetId, ok: true, rel });
        continue;
      }

      if (tool === "conversation_mute") {
        const conversationId = String(o?.conversationId ?? "");
        if (!conversationId) continue;
        const key = `mute:${conversationId}`;
        const { data, error } = await supabase
          .from("conversation_prefs")
          .select("muted,muted_until")
          .eq("user_id", userId)
          .eq("conversation_id", conversationId)
          .maybeSingle();
        push(key, { tool, conversationId, ok: !error && !!data, muted: (data as any)?.muted ?? null });
        continue;
      }
    }

    const ok = checks.every((c) => c?.ok !== false);
    return { ok, checks };
  } catch (e: any) {
    return { ok: false, checks: [{ ok: false, error: String(e?.message ?? e ?? "VERIFY_FAILED") }] };
  }
}

async function toolPlanExecute(supabase: any, userId: string, args: any) {
  const rawSteps: any[] = Array.isArray(args?.steps) ? args.steps : [];
  const preferTx = args?.preferTx === false ? false : true;
  const verify = args?.verify === false ? false : true;
  const returnOutputs = args?.returnOutputs === false ? false : true;
  const maxSteps = Math.max(1, Math.min(10, Number(args?.maxSteps ?? (rawSteps.length || 5))));

  const steps = rawSteps.slice(0, maxSteps).map((s) => ({
    tool: String(s?.tool ?? "").trim(),
    args: (s?.args && typeof s.args === "object") ? s.args : {},
  }));

  if (!steps.length) throw new Error("Missing steps");
  if (steps.some((s) => s.tool === "plan_execute")) throw new Error("plan_execute cannot be nested");

  const txSupported = new Set([
    "create_list",
    "list_add_item",
    "list_add_items",
    "list_remove_item",
    "list_set_visibility",
    "rate_title",
    "review_upsert",
    "diary_set_status",
    "follow_user",
    "unfollow_user",
    "block_user",
    "unblock_user",
    "notifications_mark_read",
    "conversation_mute",
  ]);

  const unsupported = steps
    .map((s) => s.tool)
    .filter((t) => !txSupported.has(t));

  if (preferTx) {
    if (unsupported.length) {
      throw new Error(
        `This plan contains tools that are not transaction-enabled: ${[...new Set(unsupported)].join(", ")}. ` +
        `Split the plan or set preferTx=false.`,
      );
    }

    const { data, error } = await supabase.rpc("assistant_tx_plan_execute_v1", {
      p_plan: { steps },
    });

    if (error) {
      // If the SQL function raised a JSON payload, surface it.
      const msg = String((error as any)?.message ?? "");
      try {
        const parsed = JSON.parse(msg);
        const rolled = parsed?.rolledBack === false ? "" : " (rolled back)";
        throw new Error(`PLAN_TX_FAILED: ${parsed?.error ?? msg}${rolled}`);
      } catch {
        throw new Error(`PLAN_TX_FAILED: ${msg || "Unknown error"}`);
      }
    }

    // The SQL function can also return a structured failure payload (rollback-only summary).
    if ((data as any)?.ok === false) {
      const err = String((data as any)?.error ?? "Unknown error");
      const rolled = (data as any)?.rolledBack === false ? "" : " (rolled back)";
      throw new Error(`PLAN_TX_FAILED: ${err}${rolled}`);
    }

    const out: any = { mode: "tx", ...(data ?? {}) };
    if (!returnOutputs) delete out.outputs;
    if (verify) {
      out.verified = await verifyTxOutputs(supabase, userId, (data as any)?.outputs ?? []);
    }
    return out;
  }

  // Sequential fallback (non-atomic). PreferTx=false is explicitly opt-in.
  const results: any[] = [];
  for (const s of steps) {
    const r = await executeAssistantTool(supabase, userId, { tool: s.tool as any, args: s.args });
    results.push({
      tool: s.tool,
      ok: r.ok,
      result: r.ok ? (r as any).result ?? null : { code: (r as any).code, message: (r as any).message, token: (r as any).token },
    });
  }
  return { mode: "sequential", steps: results };
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
  const contentTypeRaw = typeof args?.contentType === "string" ? args.contentType : null;
  const note = typeof args?.note === "string" ? args.note.slice(0, 200) : null;
  if (!listId) throw new Error("Missing listId");
  if (!titleId) throw new Error("Missing titleId");
  const contentType = await resolveContentType(supabase, titleId, contentTypeRaw);

  // Ownership check.
  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (listError) throw new Error(listError.message);
  if (!list) throw new Error("List not found");

  // Dedupe: if already in list, return existing position (do not insert).
  const { data: existing, error: exErr } = await supabase
    .from("list_items")
    .select("id,position")
    .eq("list_id", listId)
    .eq("title_id", titleId)
    .limit(1)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  if (existing?.id) {
    return {
      listId,
      titleId,
      alreadyInList: true,
      position: Number((existing as any)?.position ?? 0) || 0,
      navigateTo: `/lists/${listId}`,
    };
  }

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
  const titleId = coerceString(args?.titleId).trim();
  const status = coerceString(args?.status).trim();
  const contentTypeRaw = typeof args?.contentType === "string" ? args.contentType : null;
  if (!titleId) throw new Error("Missing titleId");
  if (!status) throw new Error("Missing status");

  // Resolve movie vs series deterministically from the catalog when possible.
  const contentType = await resolveContentType(supabase, titleId, contentTypeRaw);
  const updatedAt = new Date().toISOString();

  // Write: upsert (do not rely on returned rows — RLS can suppress them).
  const { error: upsertErr } = await supabase
    .from("library_entries")
    .upsert(
      {
        user_id: userId,
        title_id: titleId,
        status,
        updated_at: updatedAt,
        content_type: contentType,
      },
      { onConflict: "user_id,title_id" },
    );

  if (upsertErr) throw new Error(upsertErr.message);

  // Verify: read back the row (prevents "silent" failures and avoids false positives).
  const { data: row, error: verifyErr } = await supabase
    .from("library_entries")
    .select("title_id,status,content_type")
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .maybeSingle();

  if (verifyErr) throw new Error(`Write verification failed: ${verifyErr.message}`);
  if (!row) throw new Error("Write verification failed (row not visible)");

  const gotStatus = String((row as any)?.status ?? "").trim();
  if (gotStatus && gotStatus !== status) {
    throw new Error("Write verification failed (status mismatch)");
  }

  return {
    titleId,
    status,
    contentType: (row as any)?.content_type ?? contentType,
    verified: true,
  };
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
    // create_direct_conversation_v1() returns a UUID (string), not an object.
    // Be defensive in case older deployments returned { id }.
    if (typeof data === "string") conversationId = data;
    else if (data && typeof data === "object" && "id" in (data as any)) conversationId = String((data as any).id);
    else conversationId = null;
  }

  if (!conversationId) throw new Error("Missing conversationId or targetUserId");

  const clientIdRaw = typeof args?.clientId === "string" ? args.clientId.trim() : "";
  const clientId = clientIdRaw ? clientIdRaw.slice(0, 120) : `assistant-${uuid()}`;
  const extraMeta = args?.meta && typeof args.meta === "object" ? args.meta : null;
  const body = {
    type: "text",
    text,
  };
  const meta = {
    ...(extraMeta && typeof extraMeta === "object" ? extraMeta : {}),
    sentViaAssistant: true,
  };

  // Best-effort dedupe: if this clientId already exists in the conversation,
  // return success without inserting a duplicate.
  if (clientIdRaw) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("client_id", clientId)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { conversationId, navigateTo: `/messages/${conversationId}`, deduped: true };
    }
  }

  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    sender_id: userId,
    body,
    message_type: "text",
    text,
    client_id: clientId,
    meta,
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
  const args = parseToolArgs(tool, call.args ?? {});

  try {
    switch (tool) {
    case "schema_summary": {
      const r = toolSchemaSummary();
      return { ok: true, tool, result: r };
    }
    case "db_read": {
      const r = await toolDbRead(supabase, userId, args);
      return { ok: true, tool, result: r };
    }
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

    case "get_my_profile": {
      const r = await toolGetMyProfile(supabase, userId);
      return { ok: true, tool, result: r };
    }
    case "get_my_stats": {
      const r = await toolGetMyStats(supabase, userId);
      return { ok: true, tool, result: r };
    }
    case "get_ctx_snapshot": {
      const r = await toolGetCtxSnapshot(supabase, userId, args);
      return { ok: true, tool, result: r };
    }
    case "get_my_lists": {
      const r = await toolGetMyLists(supabase, userId, args);
      return { ok: true, tool, result: r };
    }
    case "get_list_items": {
      const r = await toolGetListItems(supabase, userId, args);
      return { ok: true, tool, result: r };
    }
    case "get_my_library": {
      const r = await toolGetMyLibrary(supabase, userId, args);
      return { ok: true, tool, result: r };
    }
    case "search_catalog": {
      const r = await toolSearchCatalog(supabase, args);
      return { ok: true, tool, result: r };
    }
    case "search_my_library": {
      const r = await toolSearchMyLibrary(supabase, userId, args);
      return { ok: true, tool, result: r };
    }
    case "get_my_recent_activity": {
      const r = await toolGetMyRecentActivity(supabase, userId, args);
      return { ok: true, tool, result: r };
    }

    case "get_tool_result": {
      const r = await toolGetToolResult(supabase, userId, args);
      return { ok: true, tool, result: r };
    }

    case "get_trending": {
      const r = await toolGetTrending(supabase, args);
      return { ok: true, tool, result: r };
    }

    case "get_recommendations": {
      const r = await toolGetRecommendations(supabase, userId, args);
      return { ok: true, tool, result: r };
    }

    case "resolve_title": {
      const r = await toolResolveTitle(supabase, args);
      return { ok: true, tool, result: r };
    }

    case "resolve_list": {
      const r = await toolResolveList(supabase, userId, args);
      return { ok: true, tool, result: r };
    }

    case "resolve_user": {
      const r = await toolResolveUser(supabase, args);
      return { ok: true, tool, result: r };
    }

    case "get_my_rating": {
      const r = await toolGetMyRating(supabase, userId, args);
      return { ok: true, tool, result: r };
    }

    case "get_my_review": {
      const r = await toolGetMyReview(supabase, userId, args);
      return { ok: true, tool, result: r };
    }

    case "get_relationship_status": {
      const r = await toolGetRelationshipStatus(supabase, userId, args);
      return { ok: true, tool, result: r };
    }

    case "plan_execute": {
      const r = await toolPlanExecute(supabase, userId, args);
      return { ok: true, tool, result: r, navigateTo: (r as any)?.navigateTo ?? null };
    }
    case "create_list": {
      const r = await toolCreateList(supabase, userId, args);
      return { ok: true, tool, result: r, navigateTo: (r as any).navigateTo ?? null };
    }
    case "list_add_item": {
      const r = await toolListAddItem(supabase, userId, args);
      return { ok: true, tool, result: r, navigateTo: (r as any).navigateTo ?? null };
    }

    case "list_add_items": {
      const r = await toolListAddItems(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "list_remove_item": {
      const r = await toolListRemoveItem(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "list_set_visibility": {
      const r = await toolListSetVisibility(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "rate_title": {
      const r = await toolRateTitle(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "review_upsert": {
      const r = await toolReviewUpsert(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "follow_user": {
      const r = await toolFollowUser(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "unfollow_user": {
      const r = await toolUnfollowUser(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "block_user": {
      const r = await toolBlockUser(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "unblock_user": {
      const r = await toolUnblockUser(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "notifications_mark_read": {
      const r = await toolNotificationsMarkRead(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    case "conversation_mute": {
      const r = await toolConversationMute(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }

    // Internal-only rollback helpers (not exposed to the model)
    case "list_delete": {
      const r = await toolListDelete(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }
    case "rating_delete": {
      const r = await toolRatingDelete(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
    }
    case "review_delete": {
      const r = await toolReviewDelete(supabase, userId, call.args);
      return { ok: true, tool: call.tool, result: r };
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
  } catch (err) {
    const normalized = normalizeToolError(tool, err);
    log(
      { fn: "assistantTools", userId },
      "Tool execution failed",
      {
        tool,
        code: normalized.code,
        message: normalized.message,
        token: normalized.token,
        argsKeys: Object.keys(args ?? {}),
        errorCode: normalized.meta?.errorCode ?? null,
      },
    );
    return normalized;
  }
}
