import React from "react";
import { describe, it, expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConversationListRow } from "../modules/messages/MessagesPage";
import { TitleSearchResultRow } from "../modules/search/SearchTitlesTab";
import { FeedSkeleton } from "../modules/home/HomeFeedTab";
import { CarouselsSkeleton, TonightPickSkeleton } from "../modules/home/HomeForYouTab";
import { LoadingSwipeCard } from "../modules/swipe/SwipePage";
import type { ConversationListItem } from "../modules/messages/useConversations";
import type { TitleSearchResult } from "../modules/search/useSearchTitles";

expect.extend(matchers);

const baseConversation: ConversationListItem = {
  id: "conv-1",
  title: "Movie Night",
  lastMessageAt: "2025-01-01T00:00:00Z",
  lastMessageAtLabel: "Just now",
  lastMessagePreview: "See you soon",
  hasUnread: false,
  isGroup: false,
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
  posterUrl: null,
  tmdbId: "27205",
  imdbId: "tt1375666",
  originalLanguage: "en",
  ageRating: "PG-13",
  imdbRating: 8.8,
  rtTomatoMeter: 87,
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
      <MemoryRouter>
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

describe("TitleSearchResultRow", () => {
  it("shows poster fallback and metadata summary", () => {
    render(
      <MemoryRouter>
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
      <MemoryRouter>
        <LoadingSwipeCard />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Getting picks/i)).toBeInTheDocument();
    expect(screen.getByText(/Finding what friends like/i)).toBeInTheDocument();
  });
});
