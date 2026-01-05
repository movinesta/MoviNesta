const QUIET_UNTIL_KEY = "assistant_quiet_until_v1";

export function getAssistantQuietUntil(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(QUIET_UNTIL_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function setAssistantQuietForMs(ms: number) {
  if (typeof window === "undefined") return;
  try {
    const until = Date.now() + Math.max(0, ms);
    window.localStorage.setItem(QUIET_UNTIL_KEY, String(until));
  } catch {
    // ignore
  }
}

export function clearAssistantQuiet() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(QUIET_UNTIL_KEY);
  } catch {
    // ignore
  }
}
