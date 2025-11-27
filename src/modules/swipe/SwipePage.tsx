import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Flame, Users, Sparkles } from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import HeroCard from "../../components/shared/HeroCard";
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

const SwipePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SwipeTabKey>("forYou");

  const activeConfig = SWIPE_TABS.find((tab) => tab.key === activeTab) ?? SWIPE_TABS[0];

  return (
    <div className="flex flex-1 flex-col gap-5 pb-4">
      <TopBar title="Swipe" subtitle="Shape your recommendations" />

      <HeroCard
        title="Swipe deck"
        subtitle="Swipe to shape your recommendations."
        badge="Curated"
        size="small"
      />

      <section className="space-y-3">
        <SegmentedControl
          segments={SWIPE_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
          active={activeTab}
          onChange={setActiveTab}
        />
        <p className="text-[12px] text-mn-text-secondary">{activeConfig.description}</p>
      </section>

      <section aria-live="polite" className="flex-1" id={`swipe-tabpanel-${activeTab}`}>
        <div className="relative min-h-[60vh] rounded-2xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 p-3 shadow-mn-soft">
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
