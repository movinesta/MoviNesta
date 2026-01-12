// supabase/functions/_shared/assistantUndo.ts

export type UndoPlan = {
  tool: string;
  args: Record<string, unknown>;
  internal?: boolean;
  label?: string;
};

// Best-effort undo derivation.
// Only provide undo when we can be confident it is safe and scoped.
export function deriveUndoPlan(tool: string, args: any, result: any): UndoPlan | null {
  const t = String(tool ?? "").trim();
  const a = args && typeof args === "object" ? args : {};
  const r = result && typeof result === "object" ? result : {};

  if (t === "create_list") {
    const listId = typeof (r as any).listId === "string" ? String((r as any).listId) : null;
    if (!listId) return null;
    return { tool: "list_delete", internal: true, args: { listId }, label: "Undo (delete list)" };
  }

  if (t === "list_add_item") {
    const listId = typeof (a as any).listId === "string" ? String((a as any).listId) : null;
    const titleId = typeof (a as any).titleId === "string" ? String((a as any).titleId) : null;
    if (!listId || !titleId) return null;
    return { tool: "list_remove_item", args: { listId, titleId }, label: "Undo" };
  }

  if (t === "rate_title") {
    const titleId = typeof (a as any).titleId === "string" ? String((a as any).titleId) : null;
    if (!titleId) return null;
    return { tool: "rating_delete", internal: true, args: { titleId }, label: "Undo (remove rating)" };
  }

  if (t === "review_upsert") {
    const titleId = typeof (a as any).titleId === "string" ? String((a as any).titleId) : null;
    if (!titleId) return null;
    return { tool: "review_delete", internal: true, args: { titleId }, label: "Undo (delete review)" };
  }

  if (t === "follow_user") {
    const targetUserId = typeof (a as any).targetUserId === "string" ? String((a as any).targetUserId) : null;
    if (!targetUserId) return null;
    return { tool: "unfollow_user", args: { targetUserId }, label: "Undo" };
  }
  if (t === "unfollow_user") {
    const targetUserId = typeof (a as any).targetUserId === "string" ? String((a as any).targetUserId) : null;
    if (!targetUserId) return null;
    return { tool: "follow_user", args: { targetUserId }, label: "Undo" };
  }

  if (t === "block_user") {
    const targetUserId = typeof (a as any).targetUserId === "string" ? String((a as any).targetUserId) : null;
    if (!targetUserId) return null;
    return { tool: "unblock_user", args: { targetUserId }, label: "Undo" };
  }
  if (t === "unblock_user") {
    const targetUserId = typeof (a as any).targetUserId === "string" ? String((a as any).targetUserId) : null;
    if (!targetUserId) return null;
    return { tool: "block_user", args: { targetUserId }, label: "Undo" };
  }

  if (t === "conversation_mute") {
    const conversationId = typeof (a as any).conversationId === "string" ? String((a as any).conversationId) : null;
    if (!conversationId) return null;
    // Unmute.
    return { tool: "conversation_mute", args: { conversationId, muted: false }, label: "Undo" };
  }

  return null;
}
