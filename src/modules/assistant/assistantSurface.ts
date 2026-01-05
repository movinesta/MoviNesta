import type { Location } from "react-router-dom";
import type { AssistantSurface } from "./types";
import { getOrCreateMediaSwipeSessionId } from "@/modules/swipe/mediaSwipeApi";

export type AssistantSurfaceContext = {
  surface: AssistantSurface;
  context: Record<string, unknown>;
};

function readQueryParam(search: string, key: string): string | null {
  try {
    const params = new URLSearchParams(search);
    const v = params.get(key);
    return v ? String(v) : null;
  } catch {
    return null;
  }
}

export function getAssistantSurfaceContext(
  location: Pick<Location, "pathname" | "search">,
): AssistantSurfaceContext {
  const path = location.pathname;

  // Title
  if (path.startsWith("/title/")) {
    const parts = path.split("/");
    const titleId = parts[2] ?? null;
    return { surface: "title", context: titleId ? { titleId } : {} };
  }

  // Swipe
  if (path === "/swipe" || path.startsWith("/swipe/")) {
    // Swipe session id is stored in localStorage.
    const sessionId = getOrCreateMediaSwipeSessionId();
    return { surface: "swipe", context: { sessionId } };
  }

  // Messages
  if (path === "/messages" || path.startsWith("/messages")) {
    const parts = path.split("/");
    const conversationId = parts.length >= 3 ? parts[2] : null;
    if (conversationId && conversationId !== "new") {
      return { surface: "messages", context: { conversationId } };
    }
    return { surface: "messages", context: {} };
  }

  // Diary
  if (path === "/diary" || path.startsWith("/diary/")) {
    return { surface: "diary", context: {} };
  }

  // Search
  if (path === "/search" || path.startsWith("/search")) {
    // Commonly used in this app: ?q=...
    const q = readQueryParam(location.search, "q") ?? readQueryParam(location.search, "query");
    return { surface: "search", context: q ? { query: q } : {} };
  }

  // Default: home
  return { surface: "home", context: {} };
}
