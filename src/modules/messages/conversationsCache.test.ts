import { describe, expect, it } from "vitest";
import { updateConversationList } from "./conversationsCache";

const base = [
  { id: "a", title: "A", hasUnread: true } as any,
  { id: "b", title: "B", hasUnread: true } as any,
];

describe("conversationsCache", () => {
  it("returns existing when not an array", () => {
    const out = updateConversationList(null, "a", (c) => c);
    expect(out).toBe(null);
  });

  it("updates a conversation item", () => {
    const out = updateConversationList(base, "a", (c) => ({ ...c, hasUnread: false }));
    expect(out).toEqual([
      { id: "a", title: "A", hasUnread: false },
      { id: "b", title: "B", hasUnread: true },
    ]);
  });

  it("moves updated item to top when moveToTop is true", () => {
    const out = updateConversationList(base, "b", (c) => ({ ...c, title: "B2" }), {
      moveToTop: true,
    });
    expect(out).toEqual([
      { id: "b", title: "B2", hasUnread: true },
      { id: "a", title: "A", hasUnread: true },
    ]);
  });

  it("returns existing when updater returns null", () => {
    const out = updateConversationList(base, "a", () => null);
    expect(out).toBe(base);
  });
});
