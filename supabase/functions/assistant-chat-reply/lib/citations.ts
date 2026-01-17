// Extracted from assistant-chat-reply/index.ts (no behavior changes).

export type UrlCitation = { url: string; title?: string; domain?: string };

export function extractUrlCitations(raw: any): UrlCitation[] {
  try {
    const out: UrlCitation[] = [];

    // Responses API shape: { output: [{ type: 'message', content: [{ type: 'output_text', text, annotations: [...] }] }] }
    const output = Array.isArray(raw?.output) ? raw.output : null;
    if (output) {
      for (const item of output) {
        if (!item || typeof item !== "object") continue;
        const content = Array.isArray((item as any).content) ? (item as any).content : [];
        for (const c of content) {
          const anns = Array.isArray((c as any).annotations) ? (c as any).annotations : [];
          for (const a of anns) {
            const url = (a as any)?.url ?? (a as any)?.url_citation?.url;
            const title = (a as any)?.title ?? (a as any)?.url_citation?.title;
            if (typeof url === "string" && url.trim()) {
              out.push({ url: url.trim(), title: typeof title === "string" ? title.trim() : undefined });
            }
          }
        }
      }
    }

    // Chat-completions fallback: { choices: [{ message: { annotations: [...] } }] }
    const anns2 = Array.isArray(raw?.choices?.[0]?.message?.annotations)
      ? raw.choices[0].message.annotations
      : null;
    if (anns2) {
      for (const a of anns2) {
        const url = (a as any)?.url ?? (a as any)?.url_citation?.url;
        const title = (a as any)?.title ?? (a as any)?.url_citation?.title;
        if (typeof url === "string" && url.trim()) {
          out.push({ url: url.trim(), title: typeof title === "string" ? title.trim() : undefined });
        }
      }
    }

    // De-dupe by URL
    const seen = new Set<string>();
    const unique: UrlCitation[] = [];
    for (const c of out) {
      const u = String(c.url ?? "").trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      unique.push({ ...c, domain: domainFromUrl(u) });
    }
    return unique;
  } catch {
    return [];
  }
}

export function domainFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return undefined;
  }
}

export function appendUrlCitations(text: string, citations: UrlCitation[]): string {
  const cs = Array.isArray(citations) ? citations.filter((c) => c && typeof c.url === "string").slice(0, 8) : [];
  if (!cs.length) return text;
  const already = /\nSources:\n/i.test(text);
  if (already) return text;

  const lines = cs.map((c) => {
    const label = c.title ? `${c.domain ? c.domain + " — " : ""}${c.title}` : (c.domain ?? c.url);
    return `- ${label} (${c.url})`;
  });
  return `${String(text ?? "").trimEnd()}\n\nSources:\n${lines.join("\n")}`;
}

export function mergeUiCitations(ui: any, citations: UrlCitation[]): any {
  const cs = Array.isArray(citations) ? citations.slice(0, 8) : [];
  if (!cs.length) return ui;
  if (ui && typeof ui === "object") {
    return { ...ui, citations: cs };
  }
  return { citations: cs };
}
