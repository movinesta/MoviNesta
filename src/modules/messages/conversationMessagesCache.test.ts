import { describe, expect, it } from "vitest";
import { mergeMessagesInfiniteData, upsertMessageRowIntoPages } from "./conversationMessagesCache";
import { mapMessageRowToConversationMessage, type MessageRow } from "./messageModel";

const makeRow = (overrides: Partial<MessageRow>): MessageRow => ({
  id: "msg-1",
  conversation_id: "conv-1",
  user_id: "user-1",
  created_at: "2024-01-01T00:00:00.000Z",
  body: { text: "hello" },
  attachment_url: null,
  ...overrides,
});

describe("upsertMessageRowIntoPages", () => {
  it("replaces existing rows without duplicates", () => {
    const row = makeRow({ id: "msg-1", body: { text: "first" } });
    const updated = makeRow({ id: "msg-1", body: { text: "updated" } });

    const existing = {
      pages: [{ items: [mapMessageRowToConversationMessage(row)], hasMore: true, cursor: null }],
      pageParams: [null],
    };

    const next = upsertMessageRowIntoPages(existing, updated);
    expect(next.pages[0]?.items).toHaveLength(1);
    expect(next.pages[0]?.items[0]?.body?.text).toBe("updated");
  });

  it("keeps messages sorted when inserting new rows", () => {
    const older = makeRow({ id: "msg-1", created_at: "2024-01-01T00:00:00.000Z" });
    const newer = makeRow({ id: "msg-2", created_at: "2024-01-02T00:00:00.000Z" });

    const existing = {
      pages: [{ items: [mapMessageRowToConversationMessage(older)], hasMore: true, cursor: null }],
      pageParams: [null],
    };

    const next = upsertMessageRowIntoPages(existing, newer);
    const ids = next.pages[0]?.items.map((item) => item.id);
    expect(ids).toEqual(["msg-1", "msg-2"]);
  });
});

describe("mergeMessagesInfiniteData", () => {
  it("preserves cached messages when refetch results are paginated", () => {
    const older = makeRow({ id: "msg-1", created_at: "2024-01-01T00:00:00.000Z" });
    const newer = makeRow({ id: "msg-2", created_at: "2024-01-02T00:00:00.000Z" });

    const existing = {
      pages: [
        {
          items: [
            mapMessageRowToConversationMessage(older),
            mapMessageRowToConversationMessage(newer),
          ],
          hasMore: true,
          cursor: null,
        },
      ],
      pageParams: [null],
    };

    const incoming = {
      pages: [
        {
          items: [mapMessageRowToConversationMessage(newer)],
          hasMore: true,
          cursor: null,
        },
      ],
      pageParams: [null],
    };

    const merged = mergeMessagesInfiniteData(existing, incoming);
    expect(merged.pages[0]?.items.map((item) => item.id)).toEqual(["msg-1", "msg-2"]);
  });

  it("prefers incoming updates for matching message ids", () => {
    const original = makeRow({ id: "msg-1", body: { text: "original" } });
    const updated = makeRow({ id: "msg-1", body: { text: "updated" } });

    const existing = {
      pages: [
        {
          items: [mapMessageRowToConversationMessage(original)],
          hasMore: true,
          cursor: null,
        },
      ],
      pageParams: [null],
    };

    const incoming = {
      pages: [
        {
          items: [mapMessageRowToConversationMessage(updated)],
          hasMore: true,
          cursor: null,
        },
      ],
      pageParams: [null],
    };

    const merged = mergeMessagesInfiniteData(existing, incoming);
    expect(merged.pages[0]?.items[0]?.body?.text).toBe("updated");
  });
});
