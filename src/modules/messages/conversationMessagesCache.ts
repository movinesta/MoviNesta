import type { InfiniteData } from "@tanstack/react-query";
import type { ConversationMessage, MessageRow } from "./messageModel";
import { mapMessageRowToConversationMessage } from "./messageModel";
import { getMessageClientId } from "./messageText";
import { isTempId } from "./idUtils";
import { safeTime } from "./time";
import type { ConversationMessagesPage } from "./useConversationMessages";

type MessagesInfiniteData = InfiniteData<ConversationMessagesPage>;

const createEmptyMessagesInfiniteData = (): MessagesInfiniteData => ({
  pages: [{ items: [], hasMore: true, cursor: null }],
  pageParams: [null],
});

export const stableSortMessages = (items: ConversationMessage[]): ConversationMessage[] => {
  return [...items].sort((a, b) => {
    const at = safeTime(a.createdAt);
    const bt = safeTime(b.createdAt);
    if (at !== bt) return at - bt;
    return a.id.localeCompare(b.id);
  });
};

const dedupeMessagesByClientId = (items: ConversationMessage[]): ConversationMessage[] => {
  const byId = new Map<string, ConversationMessage>();
  for (const message of items) {
    byId.set(message.id, message);
  }

  const byClientId = new Map<string, ConversationMessage[]>();
  const withoutClientId: ConversationMessage[] = [];

  for (const message of byId.values()) {
    const clientId = message.clientId ?? getMessageClientId(message.body);
    if (!clientId) {
      withoutClientId.push(message);
      continue;
    }
    const group = byClientId.get(clientId);
    if (group) {
      group.push(message);
    } else {
      byClientId.set(clientId, [message]);
    }
  }

  const filtered: ConversationMessage[] = [...withoutClientId];

  for (const group of byClientId.values()) {
    if (group.length <= 1) {
      filtered.push(...group);
      continue;
    }

    const nonTemps = group.filter((message) => !isTempId(message.id));
    if (nonTemps.length > 0) {
      // Keep all server messages; drop any optimistic temps that collided.
      filtered.push(...nonTemps);
      continue;
    }

    const newest = group.reduce(
      (best, message) => {
        if (!best) return message;
        const bestTime = safeTime(best.createdAt);
        const messageTime = safeTime(message.createdAt);
        if (messageTime !== bestTime) {
          return messageTime > bestTime ? message : best;
        }
        return message.id.localeCompare(best.id) > 0 ? message : best;
      },
      null as ConversationMessage | null,
    );

    if (newest) filtered.push(newest);
  }

  return stableSortMessages(filtered);
};

export const ensureMessagesInfiniteData = (
  existing: MessagesInfiniteData | undefined,
): MessagesInfiniteData => {
  if (!existing) return createEmptyMessagesInfiniteData();
  // Defensive: some callers might have corrupted cache shape.
  if (!Array.isArray(existing.pages) || !Array.isArray(existing.pageParams)) {
    return createEmptyMessagesInfiniteData();
  }
  return existing;
};

const buildCursor = (items: ConversationMessage[]): ConversationMessagesPage["cursor"] => {
  if (!items.length) return null;
  return { createdAt: items[0].createdAt, id: items[0].id };
};

const cloneMessagesPages = (data: MessagesInfiniteData): ConversationMessagesPage[] => {
  const pages = (data.pages ?? []).map((page) => ({
    ...page,
    items: Array.isArray(page.items) ? [...page.items] : [],
  }));
  return pages.length > 0 ? pages : [{ items: [], hasMore: true, cursor: null }];
};

export const upsertMessageIntoNewestPage = (
  existing: MessagesInfiniteData | undefined,
  message: ConversationMessage,
): MessagesInfiniteData => {
  const base = ensureMessagesInfiniteData(existing);
  const pages = cloneMessagesPages(base);

  const last = pages[pages.length - 1];
  const map = new Map<string, ConversationMessage>();
  for (const m of last.items ?? []) map.set(m.id, m);
  map.set(message.id, message);

  last.items = dedupeMessagesByClientId(Array.from(map.values()));
  return { ...base, pages };
};

export const replaceMessageById = (
  existing: MessagesInfiniteData | undefined,
  updated: ConversationMessage,
): MessagesInfiniteData => {
  const base = ensureMessagesInfiniteData(existing);
  const pages = cloneMessagesPages(base).map((p) => ({
    ...p,
    items: (p.items ?? []).map((m) => (m.id === updated.id ? updated : m)),
  }));
  return { ...base, pages };
};

export const removeMessageById = (
  existing: MessagesInfiniteData | undefined,
  messageId: string,
): MessagesInfiniteData => {
  const base = ensureMessagesInfiniteData(existing);
  const pages = cloneMessagesPages(base).map((p) => ({
    ...p,
    items: (p.items ?? []).filter((m) => m.id !== messageId),
  }));
  return { ...base, pages };
};

export const reconcileSentMessage = (
  existing: MessagesInfiniteData | undefined,
  args: { tempId?: string | null; row: ConversationMessage },
): MessagesInfiniteData => {
  const base = ensureMessagesInfiniteData(existing);
  const pages = cloneMessagesPages(base);

  const tempId = args.tempId ?? null;
  const row = args.row;
  const rowClientId = row.clientId ?? getMessageClientId(row.body);

  // Remove any optimistic temp message (typically only exists on the newest page).
  if (tempId) {
    for (const page of pages) {
      page.items = (page.items ?? []).filter((m) => m.id !== tempId);
    }
  }

  // Also remove any temp message that matches the server client id.
  if (rowClientId) {
    for (const page of pages) {
      page.items = (page.items ?? []).filter(
        (m) => !(isTempId(m.id) && getMessageClientId(m.body) === rowClientId),
      );
    }
  }

  // If the server message already exists, replace it.
  let replaced = false;
  for (const page of pages) {
    const idx = (page.items ?? []).findIndex((m) => m.id === row.id);
    if (idx >= 0) {
      page.items[idx] = row;
      page.items = dedupeMessagesByClientId(page.items);
      replaced = true;
      break;
    }
  }

  // Otherwise append to newest page.
  if (!replaced) {
    const last = pages[pages.length - 1];
    last.items = dedupeMessagesByClientId([...(last.items ?? []), row]);
  }

  return { ...base, pages };
};

export const mergeMessagesInfiniteData = (
  existing: MessagesInfiniteData | undefined,
  incoming: MessagesInfiniteData | undefined,
): MessagesInfiniteData => {
  const base = ensureMessagesInfiniteData(existing);
  const next = ensureMessagesInfiniteData(incoming);

  const pageParamKey = (param: unknown) => {
    if (param == null) return "initial";
    if (typeof param === "string") return `s:${param}`;
    if (typeof param === "number") return `n:${param}`;
    if (typeof param === "boolean") return `b:${param}`;
    if (typeof param === "object") {
      try {
        return `o:${JSON.stringify(param)}`;
      } catch {
        return "o:[unserializable]";
      }
    }
    return `u:${String(param)}`;
  };

  const existingByParam = new Map<string, ConversationMessagesPage>();
  const existingParams = base.pageParams ?? [];
  for (const [index, page] of base.pages.entries()) {
    const param = existingParams[index];
    existingByParam.set(pageParamKey(param), page);
  }

  const nextByParam = new Map<string, ConversationMessagesPage>();
  const nextParams = next.pageParams ?? [];
  for (const [index, page] of next.pages.entries()) {
    const param = nextParams[index];
    nextByParam.set(pageParamKey(param), page);
  }

  const pages: ConversationMessagesPage[] = [];
  const pageParams: unknown[] = [];
  const orderParams = (next.pages.length >= base.pages.length ? nextParams : existingParams) ?? [];
  const seen = new Set<string>();

  for (const param of orderParams) {
    const key = pageParamKey(param);
    if (seen.has(key)) continue;
    seen.add(key);

    const existingPage = existingByParam.get(key);
    const nextPage = nextByParam.get(key);

    if (!existingPage && !nextPage) continue;
    if (!existingPage) {
      pages.push(nextPage!);
      pageParams.push(param);
      continue;
    }
    if (!nextPage) {
      if (existingPage) {
        pages.push(existingPage);
        pageParams.push(param);
      }
      continue;
    }

    const mergedMap = new Map<string, ConversationMessage>();
    for (const message of existingPage.items ?? []) {
      mergedMap.set(message.id, message);
    }
    for (const message of nextPage.items ?? []) {
      mergedMap.set(message.id, message);
    }

    const items = dedupeMessagesByClientId(Array.from(mergedMap.values()));

    pages.push({
      ...nextPage,
      items,
      cursor: buildCursor(items),
      hasMore: nextPage.hasMore ?? existingPage.hasMore ?? true,
    });
    pageParams.push(param);
  }

  const appendMissing = (params: unknown[], map: Map<string, ConversationMessagesPage>) => {
    for (const param of params) {
      const key = pageParamKey(param);
      if (seen.has(key)) continue;
      const page = map.get(key);
      if (!page) continue;
      seen.add(key);
      pages.push(page);
      pageParams.push(param);
    }
  };

  appendMissing(nextParams, nextByParam);
  appendMissing(existingParams, existingByParam);

  return {
    ...next,
    pages: pages.length > 0 ? pages : [{ items: [], hasMore: true, cursor: null }],
    pageParams: pageParams.length > 0 ? pageParams : (next.pageParams ?? base.pageParams),
  };
};

/**
 * Used by realtime updates: upsert the incoming row and reconcile against optimistic temp messages.
 */
export const upsertMessageRowIntoPages = (
  existing: MessagesInfiniteData | undefined,
  row: MessageRow,
  options?: { allowAppend?: boolean },
): MessagesInfiniteData => {
  const allowAppend = options?.allowAppend ?? true;
  const incomingMsg = mapMessageRowToConversationMessage(row);
  const clientId = incomingMsg.clientId ?? getMessageClientId(incomingMsg.body);

  const base = ensureMessagesInfiniteData(existing);
  const pages = cloneMessagesPages(base);

  // 1) If we have a clientId, remove any optimistic temp message with same clientId.
  if (clientId) {
    for (const page of pages) {
      const idx = (page.items ?? []).findIndex(
        (m) => isTempId(m.id) && getMessageClientId(m.body) === clientId,
      );
      if (idx >= 0) {
        page.items.splice(idx, 1);
        break;
      }
    }
  }

  // 2) Replace if same ID exists.
  for (const page of pages) {
    const idx = (page.items ?? []).findIndex((m) => m.id === incomingMsg.id);
    if (idx >= 0) {
      page.items[idx] = incomingMsg;
      page.items = stableSortMessages(page.items);
      return { ...base, pages };
    }
  }

  // 3) Otherwise, append to the newest page (insert-only behavior).
  if (allowAppend) {
    const last = pages[pages.length - 1];
    last.items = dedupeMessagesByClientId([...(last.items ?? []), incomingMsg]);
  }

  return { ...base, pages };
};
