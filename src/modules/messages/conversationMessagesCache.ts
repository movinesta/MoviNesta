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

  last.items = stableSortMessages(Array.from(map.values()));
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

  // Remove any optimistic temp message (typically only exists on the newest page).
  if (tempId) {
    for (const page of pages) {
      page.items = (page.items ?? []).filter((m) => m.id !== tempId);
    }
  }

  // If the server message already exists, replace it.
  let replaced = false;
  for (const page of pages) {
    const idx = (page.items ?? []).findIndex((m) => m.id === row.id);
    if (idx >= 0) {
      page.items[idx] = row;
      page.items = stableSortMessages(page.items);
      replaced = true;
      break;
    }
  }

  // Otherwise append to newest page.
  if (!replaced) {
    const last = pages[pages.length - 1];
    last.items = stableSortMessages([...(last.items ?? []), row]);
  }

  return { ...base, pages };
};

export const mergeMessagesInfiniteData = (
  existing: MessagesInfiniteData | undefined,
  incoming: MessagesInfiniteData | undefined,
): MessagesInfiniteData => {
  const base = ensureMessagesInfiniteData(existing);
  const next = ensureMessagesInfiniteData(incoming);

  const pages: ConversationMessagesPage[] = [];
  const pageCount = Math.max(base.pages.length, next.pages.length);

  for (let index = 0; index < pageCount; index += 1) {
    const existingPage = base.pages[index];
    const nextPage = next.pages[index];

    if (!nextPage) {
      pages.push(existingPage);
      continue;
    }

    const mergedMap = new Map<string, ConversationMessage>();
    for (const message of existingPage?.items ?? []) {
      mergedMap.set(message.id, message);
    }
    for (const message of nextPage.items ?? []) {
      mergedMap.set(message.id, message);
    }

    const items = stableSortMessages(Array.from(mergedMap.values()));

    pages.push({
      ...nextPage,
      items,
      cursor: buildCursor(items),
      hasMore: nextPage.hasMore ?? existingPage?.hasMore ?? true,
    });
  }

  return {
    ...next,
    pages: pages.length > 0 ? pages : [{ items: [], hasMore: true, cursor: null }],
    pageParams: next.pageParams.length > 0 ? next.pageParams : base.pageParams,
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
  const clientId = getMessageClientId(incomingMsg.body);

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
    last.items = stableSortMessages([...(last.items ?? []), incomingMsg]);
  }

  return { ...base, pages };
};
