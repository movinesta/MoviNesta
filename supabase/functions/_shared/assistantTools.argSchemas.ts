// supabase/functions/_shared/assistantTools.argSchemas.ts
//
// Tool argument schemas + parser shared by assistant tools.

import { z } from "zod";
import { normalizeToolArgs } from "./assistantToolArgs.ts";
import type { AssistantToolName } from "./assistantTools.types.ts";

const zUuid = z.string().uuid();
const zContentType = z.enum(["movie", "series", "anime"]);
const zRating = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
  z.number().min(0).max(10).refine((n) => Math.round(n * 2) / 2 === n, { message: "rating must be in 0.5 steps" }),
);

export const TOOL_ARG_SCHEMAS: Partial<Record<AssistantToolName, z.ZodTypeAny>> = {
  create_list: z.object({
    name: z.string().min(1),
    description: z.string().max(2000).optional(),
    isPublic: z.boolean().optional(),
    items: z
      .array(
        z.object({
          titleId: zUuid,
          contentType: zContentType.optional(),
          note: z.string().max(500).optional(),
        }),
      )
      .max(50)
      .optional(),
  }),

  list_add_item: z
    .object({
      listId: zUuid.optional(),
      listName: z.string().min(1).max(120).optional(),
      titleId: zUuid,
      contentType: zContentType.optional(),
      note: z.string().max(500).optional(),
    })
    .superRefine((v, ctx) => {
      if (!v.listId && !v.listName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide listId or listName", path: ["listId"] });
      }
    }),

  list_add_items: z
    .object({
      listId: zUuid.optional(),
      listName: z.string().min(1).max(120).optional(),
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
    })
    .superRefine((v, ctx) => {
      if (!v.listId && !v.listName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide listId or listName", path: ["listId"] });
      }
    }),

  list_remove_item: z
    .object({
      listId: zUuid.optional(),
      listName: z.string().min(1).max(120).optional(),
      itemId: zUuid.optional(),
      titleId: zUuid.optional(),
    })
    .superRefine((v, ctx) => {
      if (!v.listId && !v.listName && !v.titleId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide listId, listName, or titleId", path: ["listId"] });
      }
      if (!v.itemId && !v.titleId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide itemId or titleId", path: ["titleId"] });
      }
    }),

  list_set_visibility: z
    .object({
      listId: zUuid.optional(),
      listName: z.string().min(1).max(120).optional(),
      isPublic: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (!v.listId && !v.listName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide listId or listName", path: ["listId"] });
      }
    }),

  diary_set_status: z.object({
    titleId: zUuid,
    contentType: zContentType.optional(),
    status: z.enum(["want_to_watch", "watching", "watched", "dropped"]),
  }),

  rate_title: z.object({
    titleId: zUuid,
    contentType: zContentType.optional(),
    rating: zRating,
    comment: z.string().max(2000).optional(),
  }),

  review_upsert: z.object({
    titleId: zUuid,
    contentType: zContentType.optional(),
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

export function parseToolArgs(tool: AssistantToolName, args: unknown): Record<string, unknown> {
  const baseRaw = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
  const base = normalizeToolArgs(tool, baseRaw);
  const schema = TOOL_ARG_SCHEMAS[tool];
  if (!schema) return base;
  const parsed = schema.safeParse(base);
  if (parsed.success) return parsed.data as Record<string, unknown>;
  const issues = parsed.error.issues?.slice(0, 12) ?? [];
  throw new Error(`INVALID_ARGS:${JSON.stringify(issues)}`);
}
