// supabase/functions/assistant-orchestrator/lib/utils.ts
//
// Small utility functions extracted from index.ts. Behavior-preserving.

import type { AssistantBehavior } from "../../_shared/assistantSettings.ts";
import type { AssistantSurface } from "../promptPacks.ts";

export function nowIso() {
  return new Date().toISOString();
}

export function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function toContextKey(surface: AssistantSurface, context: Record<string, unknown> | null | undefined) {
  const c = context ?? {};
  // Keep this stable and intentionally coarse. We don't want a new key for tiny changes.
  const stable: Record<string, unknown> = { surface };
  if (surface === "title" && typeof (c as any).titleId === "string") stable.titleId = (c as any).titleId;
  if (surface === "messages" && typeof (c as any).conversationId === "string") stable.conversationId = (c as any).conversationId;
  if (surface === "swipe" && typeof (c as any).sessionId === "string") stable.sessionId = (c as any).sessionId;
  // Normalize search queries to reduce cache churn (case/spacing changes shouldn't create new keys).
  if (surface === "search" && typeof (c as any).query === "string") {
    const q = String((c as any).query).trim().toLowerCase().replace(/\s+/g, " ");
    stable.query = q.slice(0, 60);
  }
  // Home/diary: nothing else.
  return JSON.stringify(stable);
}

export function ttlMinutesFor(surface: AssistantSurface, orch?: AssistantBehavior["orchestrator"]): number {
  const ttl = ((orch?.ttl_minutes ?? {}) as Record<string, unknown>);
  const v = (ttl as any)[surface] ?? (ttl as any).default;
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

export function cooldownMinutesFor(
  surface: AssistantSurface,
  proactivityLevel: 0 | 1 | 2,
  orch?: AssistantBehavior["orchestrator"],
): number {
  const cm = orch?.cooldown_minutes;
  const levelKey = proactivityLevel === 2 ? "level2" : proactivityLevel === 1 ? "level1" : "level0";
  const per = (cm as any)?.[levelKey] as Record<string, unknown> | undefined;
  const v = per ? ((per as any)[surface] ?? (per as any).default) : undefined;
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

export function dailyCapFor(proactivityLevel: 0 | 1 | 2, orch?: AssistantBehavior["orchestrator"]): number {
  const dc = orch?.daily_cap;
  const v = proactivityLevel === 2 ? (dc as any)?.level2 : proactivityLevel === 1 ? (dc as any)?.level1 : (dc as any)?.level0;
  if (typeof v === "number" && Number.isFinite(v)) return clampInt(v, 0, 200);
  // Back-compat defaults.
  if (proactivityLevel === 2) return 20;
  if (proactivityLevel === 1) return 12;
  return 0;
}
