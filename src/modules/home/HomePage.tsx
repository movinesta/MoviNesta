import React, { useState, lazy, Suspense } from "react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import type { LucideIcon } from "lucide-react";
import { Heart, MessageCircle, Plus, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopBar from "../../components/shared/TopBar";
import ChipRow from "../../components/shared/ChipRow";
import { Chip } from "@/components/ui/Chip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import CreateActionSheet from "@/components/shared/CreateActionSheet";

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
    <Chip variant={variant === "feed" ? "default" : "accent"} className="gap-1">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {description}
    </Chip>
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
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<HomeTabKey>("feed");
  const [isFeedFiltersOpen, setIsFeedFiltersOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const activeTabConfig = HOME_TABS[activeTab];

  const handleQuickFilterChange = (key: QuickFilterKey) => {
    setQuickFilter(key);
  };

  const computedDescription =
    activeTab === "feed" ? getFeedDescription(quickFilter) : activeTabConfig.description;

  return (
    <main className="flex flex-1 flex-col gap-5 pb-4" role="main">
      <TopBar
        title="MoviNesta"
        actions={[
          {
            icon: Plus,
            label: "Create",
            onClick: () => setIsCreateOpen(true),
          },
          {
            icon: Heart,
            label: "Activity",
            onClick: () => navigate("/activity"),
          },
          {
            icon: MessageCircle,
            label: "Messages",
            onClick: () => navigate("/messages"),
          },
        ]}
        below={
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              const nextTab = value as HomeTabKey;
              setActiveTab(nextTab);
              if (nextTab !== "feed") {
                setQuickFilter("all");
              }
            }}
          >
            <TabsList className="w-full">
              {HOME_TABS_LIST.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <section className="space-y-3">
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
            <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
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

      <CreateActionSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </main>
  );
};

export default HomePage;
