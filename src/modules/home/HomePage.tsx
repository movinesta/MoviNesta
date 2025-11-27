import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Sparkles, Users, SlidersHorizontal } from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import HeroCard from "../../components/shared/HeroCard";
import SegmentedControl from "../../components/shared/SegmentedControl";
import ChipRow from "../../components/shared/ChipRow";
import HomeFeedTab from "./HomeFeedTab";
import HomeForYouTab from "./HomeForYouTab";

export type HomeTabKey = "feed" | "forYou";

interface HomeTabConfig {
  key: HomeTabKey;
  label: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
}

const HOME_TABS: HomeTabConfig[] = [
  {
    key: "feed",
    label: "Feed",
    icon: Users,
    description: "See what you and your friends have been watching, rating, and reviewing.",
    badge: "Live",
  },
  {
    key: "forYou",
    label: "For You",
    icon: Sparkles,
    description: "Lightweight recommendations based on your diary activity and library.",
  },
];

const HomePage: React.FC = () => {
  useDocumentTitle("Home");
  const [activeTab, setActiveTab] = useState<HomeTabKey>("feed");
  const [isFeedFiltersOpen, setIsFeedFiltersOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<"all" | "follows" | "reviews">("all");
  const navigate = useNavigate();

  const activeTabConfig = HOME_TABS.find((tab) => tab.key === activeTab) ?? HOME_TABS[0];

  return (
    <div className="flex flex-1 flex-col gap-5 pb-4">
      <TopBar showLogo title="Home" subtitle="Stay close to what friends are watching" />

      <HeroCard
        title="Welcome back"
        subtitle="Track what you watch and see what friends love."
        primaryAction={{ label: "Start swiping", onClick: () => navigate("/swipe") }}
        secondaryAction={{
          label: "Open diary",
          variant: "ghost",
          onClick: () => navigate("/diary"),
        }}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="w-full max-w-lg">
            <SegmentedControl
              segments={HOME_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
              active={activeTab}
              onChange={setActiveTab}
            />
          </div>
          {activeTab === "feed" && (
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-mn-border-subtle/80 bg-mn-bg-elevated/70 text-mn-text-primary shadow-mn-soft hover:border-mn-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              onClick={() => setIsFeedFiltersOpen(true)}
              aria-label="Feed filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>

        {activeTab === "feed" && (
          <ChipRow
            options={[
              { key: "all", label: "All" },
              { key: "follows", label: "Friends" },
              { key: "reviews", label: "Reviews" },
            ]}
            active={quickFilter}
            onChange={(key) => setQuickFilter(key)}
          />
        )}

        <p className="text-[12px] text-mn-text-secondary">{activeTabConfig.description}</p>
      </section>

      <section aria-live="polite" className="flex-1" id={`home-tabpanel-${activeTab}`}>
        {activeTab === "feed" ? (
          <HomeFeedTab
            isFiltersSheetOpen={isFeedFiltersOpen}
            onFiltersSheetOpenChange={setIsFeedFiltersOpen}
            quickFilter={quickFilter}
          />
        ) : (
          <HomeForYouTab />
        )}
      </section>
    </div>
  );
};

export default HomePage;
