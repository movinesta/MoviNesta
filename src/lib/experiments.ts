import { supabase } from "@/lib/supabase";

type Cached = {
  v: 1;
  ts: number;
  assignments: Record<string, string>;
};

const LS_KEY = "mn_rec_experiment_assignments_v1";

function readCache(): Cached | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (parsed?.v !== 1 || typeof parsed.ts !== "number" || typeof parsed.assignments !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(assignments: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    const payload: Cached = { v: 1, ts: Date.now(), assignments };
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/**
 * Best-effort fetch of stable experiment assignments for the current user.
 *
 * This is designed to be "safe to call" from UI hooks:
 * - returns cached values when fresh
 * - never throws on cache failures
 */
export async function getOrFetchExperimentAssignments(
  keys: string[],
  opts?: { ttlMs?: number },
): Promise<Record<string, string>> {
  const ttlMs = opts?.ttlMs ?? 1000 * 60 * 60; // 1h
  const uniq = [...new Set((keys ?? []).map((k) => String(k).trim()).filter(Boolean))].slice(0, 20);
  if (!uniq.length) return {};

  const cached = readCache();
  if (cached && Date.now() - cached.ts < ttlMs) {
    const hit: Record<string, string> = {};
    for (const k of uniq) {
      if (cached.assignments?.[k]) hit[k] = cached.assignments[k];
    }
    // If cache covers all requested keys, return it.
    if (Object.keys(hit).length === uniq.length) return hit;
  }

  const res = await supabase.functions.invoke("experiment-assign", { body: { keys: uniq } });
  if (res.error) throw res.error;

  const data = res.data as any;
  const assignments = (data?.assignments ?? {}) as Record<string, string>;
  if (assignments && typeof assignments === "object") {
    // Merge into cache so other pages can reuse the same assignments.
    const merged = { ...(cached?.assignments ?? {}), ...assignments };
    writeCache(merged);
  }
  return assignments;
}
