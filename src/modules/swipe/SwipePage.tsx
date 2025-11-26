import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Flame, Users, Sparkles } from "lucide-react";

import SwipeForYouTab from "./SwipeForYouTab";
import SwipeFromFriendsTab from "./SwipeFromFriendsTab";
import SwipeTrendingTab from "./SwipeTrendingTab";

type SwipeTabKey = "forYou" | "friends" | "trending";

interface SwipeTabConfig {
  key: SwipeTabKey;
  label: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
}

const SWIPE_TABS: SwipeTabConfig[] = [
  {
    key: "forYou",
    label: "For You",
    icon: Flame,
    description: "Smart picks based on your taste, watchlist, and diary.",
    badge: "Recommended",
  },
  {
    key: "friends",
    label: "From Friends",
    icon: Users,
    description: "Things your friends are loving, rating, and re-watching.",
  },
  {
    key: "trending",
    label: "Trending",
    icon: Sparkles,
    description: "What’s buzzing across MoviNesta right now.",
  },
];

const SwipePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SwipeTabKey>("forYou");

  const activeConfig = SWIPE_TABS.find((tab) => tab.key === activeTab) ?? SWIPE_TABS[0];
  const ActiveTabIcon = activeConfig.icon;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-3 pt-1">
      {/* Hero header */}
      <header className="relative overflow-hidden rounded-3xl border border-mn-border-subtle/60 bg-gradient-to-br from-mn-bg-elevated via-mn-bg-elevated to-indigo-900 px-4 py-3 shadow-mn-soft">
        {/* Soft flares */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.12),transparent)]" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-[radial-gradient(circle,_rgba(56,189,248,0.12),transparent)]" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-mn-text-secondary">
              Swipe deck
            </p>
            <h1 className="font-heading text-xl font-semibold text-mn-text-primary">
              Find tonight&apos;s perfect watch
            </h1>
            <p className="max-w-xl text-[12px] leading-relaxed text-mn-text-secondary">
              Swipe to shape smarter recommendations across{" "}
              <span className="font-medium text-mn-text-primary">For You</span>,{" "}
              <span className="font-medium text-mn-text-primary">From Friends</span>, and{" "}
              <span className="font-medium text-mn-text-primary">Trending</span> decks.
            </p>
          </div>

          <div className="hidden flex-col items-end gap-2 text-[10px] text-mn-text-secondary sm:flex">
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/80 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-mn-primary" aria-hidden={true} />
              <span>Smart, taste-aware picks</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] text-mn-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Recommendations refresh as you swipe and your friends log new titles.</span>
            </span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="mt-1 flex items-center justify-between gap-3 px-1" aria-label="Swipe tabs">
        <div
          role="tablist"
          aria-orientation="horizontal"
          className="flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-mn-border-subtle/60 bg-mn-bg-elevated/70 p-1.5 backdrop-blur"
        >
          {SWIPE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`swipe-tabpanel-${tab.key}`}
                className={[
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium outline-none transition",
                  isActive
                    ? "bg-mn-primary text-mn-bg shadow-mn-soft"
                    : "bg-transparent text-mn-text-secondary hover:bg-mn-bg-elevated/70",
                ].join(" ")}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden={true} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick hint legend */}
        <div className="hidden flex-col items-end text-[10px] text-mn-text-secondary md:flex">
          <p className="inline-flex items-center gap-1">
            <span className="h-1 w-4 rounded-full bg-gradient-to-r from-emerald-400/80 via-emerald-300/80 to-transparent" />
            <span>Right = like</span>
          </p>
          <p className="inline-flex items-center gap-1">
            <span className="h-1 w-4 rounded-full bg-gradient-to-r from-rose-400/80 via-rose-300/80 to-transparent" />
            <span>Left = skip</span>
          </p>
        </div>
      </nav>

      {/* Active tab description */}
      <div className="px-1 text-[11px] text-mn-text-secondary">
        <p className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 truncate">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-mn-bg-elevated/80">
              <ActiveTabIcon className="h-3 w-3 text-mn-text-primary" aria-hidden={true} />
            </span>
            <span className="truncate">{activeConfig.description}</span>
          </span>
          {activeConfig.badge ? (
            <span className="ml-2 inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-mn-primary-soft/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mn-primary-soft">
              <Sparkles className="h-3 w-3" aria-hidden={true} />
              <span>{activeConfig.badge}</span>
            </span>
          ) : null}
        </p>
      </div>

      {/* Tab content */}
      <section aria-live="polite" className="flex-1 px-1">
        <div className="relative min-h-[60vh] rounded-3xl border border-mn-border-subtle/60 bg-mn-bg-elevated/70 p-3 shadow-mn-soft backdrop-blur">
          {activeTab === "forYou" && (
            <div id="swipe-tabpanel-forYou" role="tabpanel" className="h-full w-full">
              <SwipeForYouTab />
            </div>
          )}

          {activeTab === "friends" && (
            <div id="swipe-tabpanel-friends" role="tabpanel" className="h-full w-full">
              <SwipeFromFriendsTab />
            </div>
          )}

          {activeTab === "trending" && (
            <div id="swipe-tabpanel-trending" role="tabpanel" className="h-full w-full">
              <SwipeTrendingTab />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SwipePage;
