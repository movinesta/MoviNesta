import type { MessageReaction, ReactionSummary } from "./messageModel";

/**
 * Groups per-message reaction rows into UI summaries.
 *
 * Ordering is preserved by the first time we see each emoji for a message,
 * which typically corresponds to chronological order from the query (created_at ASC).
 */
export const buildReactionSummariesByMessageId = (
  reactions: MessageReaction[],
  currentUserId: string | null,
): Map<string, ReactionSummary[]> => {
  const byMessageEmoji = new Map<string, Map<string, ReactionSummary>>();
  const emojiOrderByMessage = new Map<string, string[]>();

  for (const reaction of reactions) {
    let emojiMap = byMessageEmoji.get(reaction.messageId);
    if (!emojiMap) {
      emojiMap = new Map<string, ReactionSummary>();
      byMessageEmoji.set(reaction.messageId, emojiMap);
      emojiOrderByMessage.set(reaction.messageId, []);
    }

    let entry = emojiMap.get(reaction.emoji);
    if (!entry) {
      entry = { emoji: reaction.emoji, count: 0, reactedBySelf: false };
      emojiMap.set(reaction.emoji, entry);
      emojiOrderByMessage.get(reaction.messageId)!.push(reaction.emoji);
    }

    entry.count += 1;
    if (currentUserId && reaction.userId === currentUserId) {
      entry.reactedBySelf = true;
    }
  }

  const result = new Map<string, ReactionSummary[]>();
  for (const [messageId, emojiMap] of byMessageEmoji.entries()) {
    const order = emojiOrderByMessage.get(messageId) ?? [];
    result.set(
      messageId,
      order.map((emoji) => emojiMap.get(emoji)!).filter(Boolean),
    );
  }

  return result;
};
