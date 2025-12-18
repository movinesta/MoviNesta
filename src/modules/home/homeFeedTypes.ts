export type AvatarColorKey = "teal" | "violet" | "orange";

export interface FeedTitle {
  id: string;
  name: string;
  year: number;
  posterUrl?: string;
  backdropUrl?: string | null;
}

export interface FeedUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  avatarInitials: string;
  avatarColor: AvatarColorKey;
}

interface BaseFeedItem {
  id: string;
  createdAt: string;
  createdAtLabel: string;
}

export type HomeFeedItem =
  | (BaseFeedItem & {
      kind: "friend-rating";
      user: FeedUser;
      title: FeedTitle;
      rating: number;
      reviewSnippet?: string;
      emoji?: string;
    })
  | (BaseFeedItem & {
      kind: "friend-review";
      user: FeedUser;
      title: FeedTitle;
      rating?: number;
      reviewSnippet?: string;
      emoji?: string;
    })
  | (BaseFeedItem & {
      kind: "watchlist-add";
      user: FeedUser;
      title: FeedTitle;
      note?: string;
    })
  | (BaseFeedItem & {
      kind: "recommendation";
      user: FeedUser;
      title: FeedTitle;
      reason?: string;
      score?: number;
    });
