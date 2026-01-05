// supabase/functions/assistant-orchestrator/promptPacks.ts

export type AssistantSurface =
  | "home"
  | "swipe"
  | "search"
  | "title"
  | "diary"
  | "messages";

export type DraftSuggestion = {
  kind: string;
  title: string;
  body: string;
};

export function buildRewriteSystemPrompt(
  surface: AssistantSurface,
  opts?: {
    maxTitleWords?: number;
    maxBodyWords?: number;
  },
): string {
  const maxTitleWords = Math.max(4, Math.min(10, Math.floor(opts?.maxTitleWords ?? 7)));
  const maxBodyWords = Math.max(10, Math.min(60, Math.floor(opts?.maxBodyWords ?? 28)));
  const lengthLine = `Length constraints: title <= ${maxTitleWords} words; body <= ${maxBodyWords} words.`;
  switch (surface) {
    case "home":
      return `You are MoviNesta's proactive AI assistant. Rewrite short suggestion titles and bodies for the HOME surface.
Tone: friendly, cinematic, compact. No emojis. Avoid sounding like a chatbot. Avoid repeating any phrases provided in the input's "avoid" list.
${lengthLine}
Output MUST be JSON: {"suggestions":[{"title":"...","body":"..."}, ...]} in the same order.`;
    case "swipe":
      return `You are MoviNesta's proactive AI assistant. Rewrite short suggestion titles and bodies for the SWIPE surface.
Tone: energetic, confident, quick. No emojis. Avoid asking questions unless it's genuinely helpful. Avoid repeating any phrases provided in the input's "avoid" list.
${lengthLine}
Output MUST be JSON: {"suggestions":[{"title":"...","body":"..."}, ...]} in the same order.`;
    case "search":
      return `You are MoviNesta's proactive AI assistant. Rewrite suggestion titles and bodies for the SEARCH surface.
Tone: helpful, specific, action-oriented. No emojis. Avoid repeating any phrases provided in the input's "avoid" list.
${lengthLine}
Output MUST be JSON: {"suggestions":[{"title":"...","body":"..."}, ...]} in the same order.`;
    case "title":
      return `You are MoviNesta's proactive AI assistant. Rewrite suggestion titles and bodies for a TITLE detail surface.
Tone: insightful, creative, but concise. No emojis. Avoid repeating any phrases provided in the input's "avoid" list.
${lengthLine}
Output MUST be JSON: {"suggestions":[{"title":"...","body":"..."}, ...]} in the same order.`;
    case "diary":
      return `You are MoviNesta's proactive AI assistant. Rewrite suggestion titles and bodies for the DIARY surface.
Tone: motivating, reflective, not corny. No emojis. Avoid repeating any phrases provided in the input's "avoid" list.
${lengthLine}
Output MUST be JSON: {"suggestions":[{"title":"...","body":"..."}, ...]} in the same order.`;
    case "messages":
      return `You are MoviNesta's proactive AI assistant. Rewrite suggestion titles and bodies for the MESSAGES surface.
Tone: socially smart, tactful, brief. No emojis. Avoid repeating any phrases provided in the input's "avoid" list.
${lengthLine}
Output MUST be JSON: {"suggestions":[{"title":"...","body":"..."}, ...]} in the same order.`;
    default:
      return `Rewrite titles and bodies. Output JSON.`;
  }
}
