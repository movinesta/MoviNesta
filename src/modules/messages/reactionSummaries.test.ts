import { describe, expect, it } from "vitest";
import { buildReactionSummariesByMessageId } from "./reactionSummaries";
import type { MessageReaction } from "./messageModel";

const r = (
  partial: Partial<MessageReaction> &
    Pick<MessageReaction, "id" | "messageId" | "emoji" | "userId">,
): MessageReaction => ({
  id: partial.id,
  conversationId: partial.conversationId ?? "c1",
  messageId: partial.messageId,
  userId: partial.userId,
  emoji: partial.emoji,
  createdAt: partial.createdAt ?? "2025-01-01T00:00:00.000Z",
});

describe("buildReactionSummariesByMessageId", () => {
  it("groups and counts by messageId + emoji", () => {
    const reactions = [
      r({ id: "1", messageId: "m1", emoji: "👍", userId: "u1" }),
      r({ id: "2", messageId: "m1", emoji: "👍", userId: "u2" }),
      r({ id: "3", messageId: "m1", emoji: "❤️", userId: "u3" }),
      r({ id: "4", messageId: "m2", emoji: "👍", userId: "u4" }),
    ];

    const map = buildReactionSummariesByMessageId(reactions, null);

    expect(map.get("m1")).toEqual([
      { emoji: "👍", count: 2, reactedBySelf: false },
      { emoji: "❤️", count: 1, reactedBySelf: false },
    ]);
    expect(map.get("m2")).toEqual([{ emoji: "👍", count: 1, reactedBySelf: false }]);
  });

  it("marks reactedBySelf if the current user reacted with that emoji", () => {
    const reactions = [
      r({ id: "1", messageId: "m1", emoji: "👍", userId: "u1" }),
      r({ id: "2", messageId: "m1", emoji: "👍", userId: "me" }),
      r({ id: "3", messageId: "m1", emoji: "❤️", userId: "u2" }),
    ];

    const map = buildReactionSummariesByMessageId(reactions, "me");

    expect(map.get("m1")).toEqual([
      { emoji: "👍", count: 2, reactedBySelf: true },
      { emoji: "❤️", count: 1, reactedBySelf: false },
    ]);
  });

  it("preserves emoji ordering by first appearance for each message", () => {
    const reactions = [
      r({ id: "1", messageId: "m1", emoji: "❤️", userId: "u1" }),
      r({ id: "2", messageId: "m1", emoji: "👍", userId: "u2" }),
      r({ id: "3", messageId: "m1", emoji: "❤️", userId: "u3" }),
      r({ id: "4", messageId: "m1", emoji: "😂", userId: "u4" }),
    ];

    const map = buildReactionSummariesByMessageId(reactions, null);
    expect(map.get("m1")?.map((x) => x.emoji)).toEqual(["❤️", "👍", "😂"]);
  });
});
