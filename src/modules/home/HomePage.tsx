import React, { useEffect, useState, lazy, Suspense } from "react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import type { LucideIcon } from "lucide-react";
import { Sparkles, Users } from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import SegmentedControl from "../../components/shared/SegmentedControl";
import ChipRow from "../../components/shared/ChipRow";

// Lazy-loaded tabs for perf
const HomeFeedTab = lazy(() => import("./HomeFeedTab"));
const HomeForYouTab = lazy(() => import("./HomeForYouTab"));

export type HomeTabKey = "feed" | "forYou";

interface HomeTabConfig {
  key: HomeTabKey;
  label: string;
  icon: LucideIcon;
  description: string;
  subtitle: string;
  badge?: string;
}

const HOME_TABS: Record<HomeTabKey, HomeTabConfig> = {
  feed: {
    key: "feed",
    label: "Feed",
    icon: Users,
    description: "Catch up on what friends watched",
    subtitle: "Stay close to what friends are watching",
    badge: "Live",
  },
  forYou: {
    key: "forYou",
    label: "For You",
    icon: Sparkles,
    description: "Quick picks from your diary",
    subtitle: "Lightweight picks based on your activity",
  },
};

const HOME_TABS_LIST = Object.values(HOME_TABS);

const QUICK_FILTER_OPTIONS: { key: QuickFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "follows", label: "Friends" },
  { key: "reviews", label: "Reviews" },
];

type QuickFilterKey = "all" | "follows" | "reviews";

interface HomeTabPillProps {
  icon: LucideIcon;
  description: string;
  variant: HomeTabKey;
}

const HomeTabPill: React.FC<HomeTabPillProps> = ({ icon: Icon, description, variant }) => (
  <div className="flex justify-center">
    <p
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] text-mn-text-secondary shadow-mn-soft transition-all duration-150 ${
        variant === "feed" ? "bg-mn-bg-elevated/70" : "bg-mn-primary/10"
      }`}
    >
      <Icon className="h-3 w-3" />
      {description}
    </p>
  </div>
);

const getFeedDescription = (quickFilter: QuickFilterKey): string => {
  switch (quickFilter) {
    case "follows":
      return "Watching just friends’ activity";
    case "reviews":
      return "You’re viewing reviews only";
    case "all":
    default:
      return "Catch up on what friends watched";
  }
};

const HomePage = () => {
  useDocumentTitle("Home");

  const [activeTab, setActiveTab] = useState<HomeTabKey>("feed");
  const [isFeedFiltersOpen, setIsFeedFiltersOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("all");

  const activeTabConfig = HOME_TABS[activeTab];

  const handleQuickFilterChange = (key: QuickFilterKey) => {
    setQuickFilter(key);
  };

  // Reset quick filter when leaving Feed
  useEffect(() => {
    if (activeTab !== "feed") {
      setQuickFilter("all");
    }
  }, [activeTab]);

  const computedDescription =
    activeTab === "feed" ? getFeedDescription(quickFilter) : activeTabConfig.description;

  return (
    <main className="flex flex-1 flex-col gap-5 pb-4" role="main">
      <TopBar showLogo title="Home" subtitle={activeTabConfig.subtitle} />

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-lg">
            <SegmentedControl
              segments={HOME_TABS_LIST.map((tab) => ({
                key: tab.key,
                label: tab.label,
              }))}
              active={activeTab}
              ariaLabel="Home sections"
              idPrefix="home-tab"
              getPanelId={(key) => `home-tabpanel-${key}`}
              onChange={(key) => setActiveTab(key as HomeTabKey)}
            />
          </div>
        </div>

        {activeTab === "feed" && (
          <div className="flex justify-center">
            <ChipRow
              options={QUICK_FILTER_OPTIONS}
              active={quickFilter}
              onChange={(key) => {
                if (QUICK_FILTER_OPTIONS.some((option) => option.key === key)) {
                  handleQuickFilterChange(key as QuickFilterKey);
                }
              }}
            />
          </div>
        )}

        <HomeTabPill
          icon={activeTabConfig.icon}
          description={computedDescription}
          variant={activeTab}
        />
      </section>

      <section
        role="tabpanel"
        aria-live="polite"
        aria-label={activeTabConfig.label}
        aria-labelledby={`home-tab-${activeTab}`}
        className="flex-1"
        id={`home-tabpanel-${activeTab}`}
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-[12px] text-mn-text-secondary">
              Loading…
            </div>
          }
        >
          {activeTab === "feed" ? (
            <HomeFeedTab
              isFiltersSheetOpen={isFeedFiltersOpen}
              onFiltersSheetOpenChange={setIsFeedFiltersOpen}
              quickFilter={quickFilter}
            />
          ) : (
            <HomeForYouTab />
          )}
        </Suspense>
      </section>
    </main>
  );
};

export default HomePage;
