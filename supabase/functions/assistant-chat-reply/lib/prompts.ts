import type { AssistantBehavior } from "../../_shared/assistantSettings.ts";

// Extracted from assistant-chat-reply/index.ts (no behavior changes).

export function renderPromptTemplate(tpl: string, vars: Record<string, string>): string {
  const s = String(tpl ?? "");
  return s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const k = String(key ?? "");
    return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k] ?? "") : "";
  });
}

export function buildChunkOutlineSystemPrompt(assistantName: string, behavior: AssistantBehavior) {
  const tpl = behavior?.prompts?.chunk_outline_template;
  if (typeof tpl === "string" && tpl.trim()) {
    return renderPromptTemplate(tpl, { name: assistantName });
  }
  return [
    `You are ${assistantName}, MoviNesta’s in-app AI companion.`,
    "Task: create a compact outline for a long-form answer the user requested.",
    "Output JSON only that matches the provided schema.",
    "Keep sections actionable. Prefer 4–6 sections.",
    "Do not mention tools, policies, or databases.",
    "Avoid spoilers.",
  ].join("\n");
}

export function buildChunkSectionSystemPrompt(assistantName: string, behavior: AssistantBehavior) {
  const tpl = behavior?.prompts?.chunk_section_template;
  if (typeof tpl === "string" && tpl.trim()) {
    return renderPromptTemplate(tpl, { name: assistantName });
  }
  return [
    `You are ${assistantName}, MoviNesta’s in-app AI companion.`,
    "Task: write ONE section of the answer (only that section).",
    "Output plain text only. Do NOT output JSON.",
    "Keep it readable and structured; concise but complete.",
    "Do not mention tools, policies, or databases.",
    "Avoid spoilers.",
    "End on a complete sentence (no cut-off).",
  ].join("\n");
}
