import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Film, Sparkles, Users, Clock, SlidersHorizontal } from "lucide-react";
import { PageHeader, PageSection } from "../../components/PageChrome";
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
  const navigate = useNavigate();

  const activeTabConfig = HOME_TABS.find((tab) => tab.key === activeTab) ?? HOME_TABS[0];

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <PageHeader
        kicker="Welcome back"
        icon={Sparkles}
        title="Your movie & anime nest"
        description="Track what you watch, build a cozy watchlist, and keep up with friends—without feeling like homework."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/swipe")}
              className="inline-flex items-center gap-1.5 rounded-full bg-mn-primary px-3 py-1.5 text-[11px] font-medium text-mn-bg shadow-mn-soft transition hover:-translate-y-px hover:bg-mn-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              <Film className="h-3.5 w-3.5" />
              Start swiping
            </button>
            <button
              type="button"
              onClick={() => navigate("/diary")}
              className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle px-2.5 py-1 text-[10px] text-mn-text-secondary transition hover:-translate-y-px hover:bg-mn-bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              <Clock className="h-3 w-3" />
              Open diary
            </button>
          </>
        }
      />

      <PageSection padded={false} tone="muted">
        <div className="flex flex-wrap gap-1.5 p-3 text-[10px] text-mn-text-muted">
          <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-0.5">
            <Film className="h-3 w-3" />
            Discover titles
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-0.5">
            <Users className="h-3 w-3" />
            Follow friends
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-0.5">
            <Clock className="h-3 w-3" />
            Build a watch history
          </span>
        </div>
      </PageSection>

      {/* Tabs header */}
      <section className="flex flex-col gap-2 px-1 sm:px-0">
        <div className="flex items-center justify-between gap-2">
          <div
            className="inline-flex rounded-full bg-mn-bg-elevated/80 p-1 text-[11px]"
            role="tablist"
            aria-label="Home sections"
          >
            {HOME_TABS.map((tab) => {
              const isActive = tab.key === activeTab;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`home-tabpanel-${tab.key}`}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition",
                    isActive
                      ? "bg-mn-primary text-mn-bg shadow-mn-soft"
                      : "text-mn-text-secondary hover:bg-mn-bg-elevated/70",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="rounded-full bg-mn-bg/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeTab === "feed" && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle px-2.5 py-1 text-[10px] text-mn-text-secondary hover:bg-mn-bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              onClick={() => setIsFeedFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span className="hidden sm:inline">Filter feed</span>
              <span className="sm:hidden">Filters</span>
            </button>
          )}
        </div>

        <p className="flex items-center gap-1 text-[11px] text-mn-text-secondary">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-mn-primary/80" />
          <span>{activeTabConfig.description}</span>
        </p>
      </section>

      {/* Tab content */}
      <section aria-live="polite" className="flex-1" id={`home-tabpanel-${activeTab}`}>
        {activeTab === "feed" ? (
          <HomeFeedTab
            isFiltersSheetOpen={isFeedFiltersOpen}
            onFiltersSheetOpenChange={setIsFeedFiltersOpen}
          />
        ) : (
          <HomeForYouTab />
        )}
      </section>
    </div>
  );
};

export default HomePage;
