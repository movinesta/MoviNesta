// Centralized React Query keys for MoviNesta
// Using typed helpers avoids typos and makes invalidation consistent.

export const qk = {
  diaryLibrary: (userId: string | null | undefined) => ["diary", "library", userId] as const,
  diaryStats: (userId: string | null | undefined) => ["diary", "stats", userId] as const,
  homeForYou: (userId: string | null | undefined) => ["home-for-you", userId] as const,
  homeFeed: (userId: string | null | undefined) => ["home-feed", userId] as const,
  titleDiary: (userId: string | null | undefined, titleId: string | null | undefined) =>
    ["title-diary", userId, titleId] as const,
  titleDetail: (titleId: string | null | undefined) => ["title-detail", titleId] as const,
  moreLikeThis: (titleId: string | null | undefined) => ["more-like-this", titleId] as const,
  conversations: (userId: string | null | undefined) =>
    ["messages", "conversations", userId] as const,
  friendsTitleReactions: (userId: string | null | undefined, titleId: string | null | undefined) =>
    ["title-friends-reactions", userId, titleId] as const,
};
