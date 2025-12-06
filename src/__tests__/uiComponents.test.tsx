import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConversationListRow } from "../modules/messages/MessagesPage";
import { getBubbleAppearance } from "../modules/messages/messageModel";
import { TitleSearchResultRow } from "../modules/search/SearchTitlesTab";
import { FeedSkeleton } from "../modules/home/HomeFeedTab";
import { CarouselsSkeleton, TonightPickSkeleton } from "../modules/home/HomeForYouTab";
import { CardMetadata, LoadingSwipeCard, PosterFallback } from "../modules/swipe/SwipePage";
import type { ConversationListItem } from "../modules/messages/useConversations";
import type { TitleSearchResult } from "../modules/search/useSearchTitles";
import type { SwipeCardData } from "../modules/swipe/useSwipeDeck";

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const baseConversation: ConversationListItem = {
  id: "conv-1",
  title: "Movie Night",
  lastMessageAt: "2025-01-01T00:00:00Z",
  lastMessageAtLabel: "Just now",
  lastMessagePreview: "See you soon",
  hasUnread: false,
  isGroup: false,
  subtitle: "Subtitle",
  lastMessageIsFromSelf: false,
  lastMessageSeenByOthers: false,
  participants: [
    {
      id: "user-1",
      displayName: "Alice",
      username: "alice",
      avatarUrl: null,
      isSelf: false,
    },
  ],
};

const sampleTitle: TitleSearchResult = {
  id: "title-1",
  title: "Inception",
  type: "movie",
  year: 2010,
  source: "library",
  posterUrl: null,
  tmdbId: 27205,
  imdbId: "tt1375666",
  originalLanguage: "en",
  ageRating: "PG-13",
  imdbRating: 8.8,
  rtTomatoMeter: 87,
};

const swipeCard: SwipeCardData = {
  id: "swipe-1",
  title: "Arrival",
  tagline: "Why are they here?",
  year: 2016,
  runtimeMinutes: 116,
  type: "movie",
  imdbRating: 8.1,
  rtTomatoMeter: 94,
  source: "for-you",
};

describe("ConversationListRow", () => {
  it("renders unread and read conversations distinctly", () => {
    const unread: ConversationListItem = {
      ...baseConversation,
      id: "conv-2",
      title: "Unread Chat",
      hasUnread: true,
    };

    const { container } = render(
      <MemoryRouter future={routerFuture}>
        <ul>
          <ConversationListRow conversation={baseConversation} />
          <ConversationListRow conversation={unread} />
        </ul>
      </MemoryRouter>,
    );

    expect(screen.getByText("Movie Night")).toHaveClass("font-medium");
    expect(screen.getByText("Unread Chat")).toHaveClass("font-semibold");

    const unreadBadges = container.querySelectorAll(".bg-mn-primary");
    expect(unreadBadges.length).toBeGreaterThan(0);
  });
});

describe("Message bubble appearance", () => {
  it("uses primary styling for self messages", () => {
    const { bubbleColors, bubbleShape } = getBubbleAppearance({
      isSelf: true,
      isDeleted: false,
    });

    expect(bubbleColors).toContain("bg-mn-primary/90");
    expect(bubbleShape).toContain("rounded-bl-3xl");
  });

  it("switches to muted dashed styling when deleted", () => {
    const { bubbleColors } = getBubbleAppearance({
      isSelf: false,
      isDeleted: true,
    });

    expect(bubbleColors).toContain("border-dashed");
    expect(bubbleColors).toContain("text-mn-text-muted");
  });
});

describe("TitleSearchResultRow", () => {
  it("shows poster fallback and metadata summary", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <ul>
          <TitleSearchResultRow item={sampleTitle} />
        </ul>
      </MemoryRouter>,
    );

    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.getByText(/2010/)).toBeInTheDocument();
    expect(screen.getByText(/IMDb 8.8/)).toBeInTheDocument();
  });
});

describe("Swipe card presentation", () => {
  it("renders key metadata for a swipe card", () => {
    render(<CardMetadata card={swipeCard} />);

    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText(/2016/)).toBeInTheDocument();
    expect(screen.getByText(/IMDb 8.1/)).toBeInTheDocument();
    expect(screen.getByText(/94% RT/)).toBeInTheDocument();
  });

  it("shows a friendly poster fallback message when artwork is missing", () => {
    render(<PosterFallback title="Arrival" />);

    expect(screen.getByText(/Artwork unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/for Arrival/)).toBeInTheDocument();
  });
});

describe("Skeleton components", () => {
  it("renders feed skeleton cards", () => {
    const { container } = render(<FeedSkeleton />);
    const cards = container.querySelectorAll("[class*='border-mn-border-subtle']");
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it("renders tonight pick and carousels skeletons", () => {
    const { container } = render(
      <div>
        <TonightPickSkeleton />
        <CarouselsSkeleton />
      </div>,
    );

    const shimmerBlocks = container.querySelectorAll(".animate-pulse");
    expect(shimmerBlocks.length).toBeGreaterThan(0);
  });
});

describe("LoadingSwipeCard", () => {
  it("displays loading badges", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <LoadingSwipeCard />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Getting picks/i)).toBeInTheDocument();
    expect(screen.getByText(/Finding what friends like/i)).toBeInTheDocument();
  });
});
