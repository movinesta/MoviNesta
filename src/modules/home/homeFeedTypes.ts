export type AvatarColorKey = "teal" | "violet" | "orange";

export type FeedUser = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarColor: AvatarColorKey;
};

export type FeedTitle = {
  id: string;
  name: string;
  posterUrl?: string | null;
  mediaType?: string | null;
  year?: number | null;
  subtitle?: string | null;
  backdropUrl?: string | null;
};

type BaseFeedItem = {
  id: string;
  createdAt: string;
  relativeTime: string;
};

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
      kind: "watchlist-remove";
      user: FeedUser;
      title: FeedTitle;
    })
  | (BaseFeedItem & {
      kind: "friend-watched";
      user: FeedUser;
      title: FeedTitle;
      rating?: number;
    })
  | (BaseFeedItem & {
      kind: "recommendation";
      user: FeedUser;
      title: FeedTitle;
      reason?: string;
      score?: number;
    });
