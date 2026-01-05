// supabase/functions/_shared/assistantCrypto.ts
//
// Small crypto helpers for edge functions (Deno).

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const helper = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (typeof v !== "object") return v;
    if (seen.has(v)) return "[Circular]";
    seen.add(v);
    if (Array.isArray(v)) return v.map(helper);
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = helper(v[k]);
    return out;
  };
  return JSON.stringify(helper(value));
}

function toHex(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += b.toString(16).padStart(2, "0");
  return s;
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function computeActionKey(payload: Record<string, unknown>): Promise<string> {
  const raw = stableStringify(payload);
  const hex = await sha256Hex(raw);
  // Keep it reasonably short for logging/headers.
  return `ak_${hex.slice(0, 32)}`;
}

export function issueConfirmToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // base64url
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `ct_${b64}`;
}
