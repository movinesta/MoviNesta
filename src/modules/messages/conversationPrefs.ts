/**
 * Conversation preferences.
 *
 * Preferred storage: Supabase (public.conversation_prefs) so settings
 * follow the user across devices.
 *
 * Backward-compat fallback: localStorage (device-level) when the backend
 * hasn't been migrated yet.
 */

import { supabase } from "@/lib/supabase";

export type ConversationPrefs = {
  muted?: boolean;
  hidden?: boolean;
  /** ISO timestamp string (timestamptz) or null */
  mutedUntil?: string | null;
};

export type ConversationPrefsResolved = {
  muted: boolean;
  hidden: boolean;
  mutedUntil: string | null;
};

type PrefsMap = Record<string, ConversationPrefs>;

const keyForUser = (userId: string | null | undefined) =>
  `movinesta.messages.conversation_prefs.v1:${userId ?? "anon"}`;

const safeParse = (raw: string | null): PrefsMap => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PrefsMap;
  } catch {
    return {};
  }
};

const normalize = (pref: ConversationPrefs | null | undefined): ConversationPrefsResolved => ({
  muted: Boolean(pref?.muted),
  hidden: Boolean(pref?.hidden),
  mutedUntil: pref?.mutedUntil ?? null,
});

export const getConversationPrefsMap = (userId: string | null | undefined): PrefsMap => {
  if (typeof window === "undefined") return {};
  return safeParse(window.localStorage.getItem(keyForUser(userId)));
};

export const setConversationPrefsMap = (userId: string | null | undefined, next: PrefsMap) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyForUser(userId), JSON.stringify(next));
};

export const setConversationPref = (
  userId: string | null | undefined,
  conversationId: string,
  patch: ConversationPrefs,
) => {
  if (!conversationId) return;
  const current = getConversationPrefsMap(userId);
  const prev = current[conversationId] ?? {};
  const merged: ConversationPrefs = { ...prev, ...patch };

  // Drop empty objects to keep storage tidy.
  const isEmpty = !merged.muted && !merged.hidden && !merged.mutedUntil;
  const next = { ...current };
  if (isEmpty) delete next[conversationId];
  else next[conversationId] = merged;

  setConversationPrefsMap(userId, next);
};

const looksLikeMissingTable = (error: unknown): boolean => {
  const message = (error as any)?.message as string | undefined;
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("conversation_prefs") &&
    (m.includes("does not exist") || m.includes("relation") || m.includes("schema cache"))
  );
};

const looksLikeMissingColumn = (error: unknown, column: string): boolean => {
  const message = (error as any)?.message as string | undefined;
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes(column.toLowerCase()) && (m.includes("does not exist") || m.includes("column"));
};

let remoteAvailability: "unknown" | "yes" | "no" = "unknown";
let remoteHasMutedUntil: "unknown" | "yes" | "no" = "unknown";

export const isRemoteConversationPrefsAvailable = async (): Promise<boolean> => {
  if (remoteAvailability !== "unknown") return remoteAvailability === "yes";
  const { error } = await (supabase as any)
    .from("conversation_prefs")
    .select("conversation_id")
    .limit(1);

  if (error) {
    remoteAvailability = looksLikeMissingTable(error) ? "no" : "unknown";
    return false;
  }

  remoteAvailability = "yes";
  return true;
};

const isRemoteMutedUntilAvailable = async (): Promise<boolean> => {
  if (remoteHasMutedUntil !== "unknown") return remoteHasMutedUntil === "yes";

  // Cheap probe: select the column once.
  const { error } = await (supabase as any)
    .from("conversation_prefs")
    .select("muted_until")
    .limit(1);

  if (error) {
    remoteHasMutedUntil = looksLikeMissingColumn(error, "muted_until") ? "no" : "unknown";
    return false;
  }

  remoteHasMutedUntil = "yes";
  return true;
};

export const saveConversationPrefs = async (
  userId: string | null | undefined,
  conversationId: string,
  prefs: ConversationPrefsResolved,
): Promise<{ ok: boolean; usedRemote: boolean }> => {
  if (!userId || !conversationId) {
    // Unauthed: local only.
    setConversationPref(userId, conversationId, prefs);
    return { ok: true, usedRemote: false };
  }

  const remoteOk = await isRemoteConversationPrefsAvailable();
  if (!remoteOk) {
    setConversationPref(userId, conversationId, prefs);
    return { ok: true, usedRemote: false };
  }

  // Keep the server tidy: delete when all flags are false / cleared.
  if (!prefs.muted && !prefs.hidden && !prefs.mutedUntil) {
    const { error } = await (supabase as any)
      .from("conversation_prefs")
      .delete()
      .eq("user_id", userId)
      .eq("conversation_id", conversationId);

    if (error) {
      if (looksLikeMissingTable(error)) {
        remoteAvailability = "no";
        setConversationPref(userId, conversationId, prefs);
        return { ok: true, usedRemote: false };
      }
      console.error("[conversationPrefs] failed to delete prefs", error);
      return { ok: false, usedRemote: true };
    }

    return { ok: true, usedRemote: true };
  }

  const hasMutedUntil = await isRemoteMutedUntilAvailable();

  const upsertRowBase: Record<string, unknown> = {
    user_id: userId,
    conversation_id: conversationId,
    muted: Boolean(prefs.muted),
    hidden: Boolean(prefs.hidden),
  };

  if (hasMutedUntil) {
    upsertRowBase["muted_until"] = prefs.mutedUntil ?? null;
  }

  const { error } = await (supabase as any)
    .from("conversation_prefs")
    .upsert(upsertRowBase, { onConflict: "user_id,conversation_id" });

  if (error) {
    if (looksLikeMissingTable(error)) {
      remoteAvailability = "no";
      setConversationPref(userId, conversationId, prefs);
      return { ok: true, usedRemote: false };
    }

    // If the table exists but the column doesn't, gracefully fall back.
    if (looksLikeMissingColumn(error, "muted_until")) {
      remoteHasMutedUntil = "no";

      // Persist duration locally so the UX still works on this device.
      if (prefs.mutedUntil)
        setConversationPref(userId, conversationId, { mutedUntil: prefs.mutedUntil });

      // Retry without muted_until.
      const { error: retryError } = await (supabase as any).from("conversation_prefs").upsert(
        {
          user_id: userId,
          conversation_id: conversationId,
          muted: Boolean(prefs.muted),
          hidden: Boolean(prefs.hidden),
        },
        { onConflict: "user_id,conversation_id" },
      );

      if (!retryError) return { ok: true, usedRemote: true };
      console.error("[conversationPrefs] failed to upsert prefs (retry)", retryError);
      return { ok: false, usedRemote: true };
    }

    console.error("[conversationPrefs] failed to upsert prefs", error);
    return { ok: false, usedRemote: true };
  }

  return { ok: true, usedRemote: true };
};

let didAttemptMigration = false;

/**
 * One-time helper: if the user has existing local prefs (from pre-migration builds),
 * push them to the server and clear localStorage.
 */
export const migrateLocalConversationPrefsToRemoteIfNeeded = async (
  userId: string | null | undefined,
): Promise<void> => {
  if (!userId || didAttemptMigration) return;
  didAttemptMigration = true;

  const local = getConversationPrefsMap(userId);
  const entries = Object.entries(local);
  if (!entries.length) return;

  const remoteOk = await isRemoteConversationPrefsAvailable();
  if (!remoteOk) return;

  const hasMutedUntil = await isRemoteMutedUntilAvailable();

  const rows = entries
    .map(([conversation_id, pref]) => {
      const normalized = normalize(pref);
      const row: Record<string, unknown> = {
        user_id: userId,
        conversation_id,
        muted: normalized.muted,
        hidden: normalized.hidden,
      };
      if (hasMutedUntil) row["muted_until"] = normalized.mutedUntil;
      return row;
    })
    .filter((row) => Boolean(row.muted) || Boolean(row.hidden) || Boolean(row.muted_until));

  if (!rows.length) {
    setConversationPrefsMap(userId, {});
    return;
  }

  const { error } = await (supabase as any)
    .from("conversation_prefs")
    .upsert(rows, { onConflict: "user_id,conversation_id" });

  if (error) {
    console.warn("[conversationPrefs] local->remote migration failed", error);
    return;
  }

  // Clear local now that the server is source of truth.
  setConversationPrefsMap(userId, {});
};

export const getConversationPref = (
  userId: string | null | undefined,
  conversationId: string,
): ConversationPrefsResolved => {
  const map = getConversationPrefsMap(userId);
  return normalize(map[conversationId]);
};

export const isMutedEffective = (pref: ConversationPrefsResolved): boolean => {
  if (pref.muted) return true;
  if (!pref.mutedUntil) return false;
  const t = Date.parse(pref.mutedUntil);
  if (!Number.isFinite(t)) return false;
  return t > Date.now();
};
