import React, { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowRight, Flame, Sparkles, Users, Wand2 } from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import SegmentedControl from "../../components/shared/SegmentedControl";

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

const tabProgress: Record<SwipeTabKey, number> = {
  forYou: 78,
  friends: 54,
  trending: 36,
};

const SwipePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SwipeTabKey>("forYou");

  const activeConfig = SWIPE_TABS.find((tab) => tab.key === activeTab) ?? SWIPE_TABS[0];
  const ActiveIcon = activeConfig.icon;
  const progressWidth = useMemo(() => tabProgress[activeTab] ?? 0, [activeTab]);

  return (
    <div className="flex flex-1 flex-col gap-5 pb-6">
      <TopBar title="Swipe" subtitle="Shape your recommendations" />

      <section className="rounded-3xl border border-mn-border-subtle/70 bg-gradient-to-br from-mn-bg-elevated/80 via-mn-bg/70 to-mn-bg-elevated/60 p-4 shadow-mn-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-mn-border-subtle/60 bg-mn-bg/70 px-3 py-1 text-[11px] uppercase tracking-wide text-mn-text-secondary">
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              <span>Curated swipes</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold leading-tight">Quick picks made for {activeConfig.label}</h2>
              <p className="text-sm text-mn-text-secondary">{activeConfig.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/80 px-4 py-3 shadow-mn-soft">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mn-text-secondary">Session focus</p>
              <p className="text-2xl font-semibold leading-tight">{progressWidth}%</p>
            </div>
            <div className="h-12 w-px bg-mn-border-subtle/70" aria-hidden="true" />
            <div className="space-y-1 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mn-text-secondary">Ready to rate</p>
              <p className="text-sm font-medium text-mn-primary">Keep swiping</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-3 shadow-mn-soft">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mn-primary/10 text-mn-primary">
              <Flame className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 text-sm">
              <p className="font-semibold">Swipe streak</p>
              <p className="text-mn-text-secondary">3 days in a row</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-3 shadow-mn-soft">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mn-primary/10 text-mn-primary">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 text-sm">
              <p className="font-semibold">Fresh cards</p>
              <p className="text-mn-text-secondary">New drops every hour</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-3 shadow-mn-soft">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mn-primary/10 text-mn-primary">
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 text-sm">
              <p className="font-semibold">Shortcuts</p>
              <p className="text-mn-text-secondary">Tap cards or swipe fast</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-2xl border border-dashed border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-3 shadow-inner">
          <SegmentedControl
            segments={SWIPE_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
            active={activeTab}
            onChange={setActiveTab}
          />

          <div className="flex flex-wrap items-center gap-3 text-[12px] text-mn-text-secondary">
            <div className="inline-flex items-center gap-2 rounded-full bg-mn-bg-elevated/80 px-3 py-1 font-medium shadow-mn-soft">
              <ActiveIcon className="h-4 w-4" aria-hidden="true" />
              <span>{activeConfig.label} feed</span>
            </div>
            <div className="min-w-[160px] flex-1">{activeConfig.description}</div>
            <div className="relative min-w-[140px] max-w-xs flex-1">
              <div className="h-2 rounded-full bg-mn-border-subtle/60" aria-hidden="true">
                <div
                  className="h-2 rounded-full bg-mn-primary transition-[width] duration-500"
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
              <span className="sr-only">{progressWidth}% session focus</span>
            </div>
          </div>
        </div>
      </section>

      <section aria-live="polite" className="flex-1" id={`swipe-tabpanel-${activeTab}`}>
        <div className="relative min-h-[64vh] rounded-3xl border border-mn-border-subtle/80 bg-mn-bg-elevated/85 p-3 shadow-mn-card">
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
