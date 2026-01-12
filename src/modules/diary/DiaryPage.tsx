import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Clock, ListChecks, BarChart3 } from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="flex flex-1 flex-col gap-4 pb-4">
      <TopBar title="Diary" />

      {/* Tabs */}
      <section className="px-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-lg">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DiaryTabKey)}>
              <TabsList className="w-full">
                {DIARY_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    icon={<tab.icon className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
        <p className="mt-1 px-1 text-xs text-muted-foreground">{activeConfig.description}</p>
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
