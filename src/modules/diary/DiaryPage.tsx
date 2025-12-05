import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Clock, ListChecks, BarChart3 } from "lucide-react";
import TopBar from "../../components/shared/TopBar";

import DiaryTimelineTab from "./DiaryTimelineTab";
import DiaryLibraryTab from "./DiaryLibraryTab";
import DiaryStatsTab from "./DiaryStatsTab";

type DiaryTabKey = "timeline" | "library" | "stats";

interface DiaryTabConfig {
  key: DiaryTabKey;
  label: string;
  icon: LucideIcon;
  description: string;
}

const DIARY_TABS: DiaryTabConfig[] = [
  {
    key: "timeline",
    label: "Timeline",
    icon: Clock,
    description: "Chronological history of your ratings, reviews, and library updates.",
  },
  {
    key: "library",
    label: "Library",
    icon: ListChecks,
    description: "Filter your watchlist and history by status and type.",
  },
  {
    key: "stats",
    label: "Stats",
    icon: BarChart3,
    description: "Rating distribution, top genres, and watch trends over time.",
  },
];

const DiaryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DiaryTabKey>("timeline");

  const activeConfig = DIARY_TABS.find((t) => t.key === activeTab) ?? DIARY_TABS[0];

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <TopBar
        title="Your clean movie diary"
        subtitle="Log what you watch, manage your library, and keep tabs on your habits without the noise."
      />

      {/* Tabs */}
      <section className="px-2">
        <nav className="mt-1 flex items-center justify-between gap-3" aria-label="Diary tabs">
          <div
            role="tablist"
            aria-orientation="horizontal"
            className="flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-mn-border-subtle/60 bg-mn-bg-elevated/80 p-1.5 backdrop-blur"
          >
            {DIARY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`diary-tabpanel-${tab.key}`}
                  className={`flex min-w-[90px] flex-1 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition
                    ${
                      isActive
                        ? "bg-mn-primary-soft text-mn-text-primary shadow-sm"
                        : "text-mn-text-secondary hover:bg-mn-bg-elevated/80 hover:text-mn-text-primary"
                    }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <p className="mt-1 px-1 text-[10px] text-mn-text-secondary">{activeConfig.description}</p>
      </section>

      {/* Content */}
      <section aria-live="polite" className="flex-1">
        {activeTab === "timeline" && (
          <div id="diary-tabpanel-timeline" role="tabpanel" className="h-full w-full">
            <DiaryTimelineTab />
          </div>
        )}

        {activeTab === "library" && (
          <div id="diary-tabpanel-library" role="tabpanel" className="h-full w-full">
            <DiaryLibraryTab />
          </div>
        )}

        {activeTab === "stats" && (
          <div id="diary-tabpanel-stats" role="tabpanel" className="h-full w-full">
            <DiaryStatsTab />
          </div>
        )}
      </section>
    </div>
  );
};

export default DiaryPage;
