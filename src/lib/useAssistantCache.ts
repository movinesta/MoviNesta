// src/lib/useAssistantCache.ts
//
// Reactive accessor for the assistant cache.
//
// Why:
/// MessagesPage + ConversationPage need to react immediately when the assistant DM is created
// and cached (e.g., during first sign-in). Reading localStorage once at mount can make the
// assistant feel "broken" until a refresh.
//

import * as React from "react";
import type { AssistantCache } from "./assistantCache";

const EVENT = "movinesta:assistant-cache";
const KEY = "movinesta.assistantCache.v1";

// IMPORTANT:
// useSyncExternalStore requires getSnapshot() to be referentially stable.
// Reading + JSON.parse on every call returns a new object each time, which can
// cause an infinite update loop. We cache the last raw value and last parsed
// snapshot and only return a new reference when the underlying storage changes.
let lastRaw: string | null | undefined = undefined;
let lastSnapshot: AssistantCache | null = null;

function subscribe(onStoreChange: () => void) {
  // localStorage updates in the same tab don't fire the "storage" event, so we also
  // listen for our custom event fired by setAssistantCache()/clearAssistantCache().
  try {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener(EVENT, onStoreChange);
  } catch {
    // ignore (non-browser environments)
  }

  return () => {
    try {
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener(EVENT, onStoreChange);
    } catch {
      // ignore
    }
  };
}

function getSnapshot(): AssistantCache | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }

  if (raw === lastRaw) return lastSnapshot;
  lastRaw = raw;

  if (!raw) {
    lastSnapshot = null;
    return null;
  }

  try {
    const obj = JSON.parse(raw) as AssistantCache;
    if (!obj?.conversationId || !obj?.assistant?.id) {
      lastSnapshot = null;
      return null;
    }
    lastSnapshot = obj;
    return obj;
  } catch {
    lastSnapshot = null;
    return null;
  }
}

export function useAssistantCache(): AssistantCache | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => null);
}
