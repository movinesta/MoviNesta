// Extracted from assistant-chat-reply/index.ts (no behavior changes).

export function uniqStrings(list: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const item of list) {
    const v = String(item ?? "").trim();
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function extractUpstreamRequestId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate =
    (raw as any).id ??
    (raw as any).request_id ??
    (raw as any).requestId ??
    null;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}
