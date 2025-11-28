import { Link } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import React, { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookmarkPlus,
  Film,
  Flame,
  ListChecks,
  MessageCircle,
  Play,
  Sparkles,
  Users,
  SlidersHorizontal,
} from "lucide-react";
import TopBar from "../../components/shared/TopBar";
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

  const quickActions = useMemo(
    () => [
      {
        title: "Swipe picks",
        description: "Shuffle tonight’s suggestions with a few easy swipes.",
        icon: Flame,
        to: "/swipe",
        accent: "from-mn-accent-teal/20 via-mn-accent-teal/8 to-mn-bg",
        badge: "New",
      },
      {
        title: "Log a watch",
        description: "Drop a quick diary note to keep recs feeling personal.",
        icon: BookmarkPlus,
        to: "/diary",
        accent: "from-mn-primary/20 via-mn-primary/8 to-mn-bg",
      },
      {
        title: "Message friends",
        description: "Kick off a movie night together without leaving the nest.",
        icon: MessageCircle,
        to: "/messages",
        accent: "from-mn-accent-violet/20 via-mn-accent-violet/8 to-mn-bg",
      },
    ],
    [],
  );

  const quickStats = useMemo(
    () => [
      {
        title: "Tonight's energy",
        value: "Lean-back • 2h",
        hint: "Pick something warm, cozy, and under 120 minutes",
        icon: Play,
        accent: "from-mn-primary/30 via-mn-primary/15 to-mn-bg",
      },
      {
        title: "Your streak",
        value: "5 days",
        hint: "Logging consistently keeps suggestions fresh",
        icon: ListChecks,
        accent: "from-mn-accent-teal/25 via-mn-accent-teal/10 to-mn-bg",
      },
      {
        title: "Next up",
        value: "3 films",
        hint: "Queued from Diary and watchlist",
        icon: Film,
        accent: "from-mn-accent-violet/25 via-mn-accent-violet/10 to-mn-bg",
      },
    ],
    [],
  );

  const activeTabConfig = HOME_TABS.find((tab) => tab.key === activeTab) ?? HOME_TABS[0];

  return (
    <div className="flex flex-1 flex-col gap-5 pb-4">
      <TopBar showLogo title="Home" subtitle="Stay close to what friends are watching" />

      <section className="relative overflow-hidden rounded-3xl border border-mn-border-subtle/70 bg-gradient-to-br from-mn-bg/90 via-mn-bg-elevated/90 to-mn-bg/85 p-5 shadow-mn-card">
        <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(20,184,166,0.14),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.14),transparent_38%),radial-gradient(circle_at_60%_80%,rgba(249,115,22,0.12),transparent_42%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)]" />
        </div>

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-mn-text-muted shadow-mn-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-mn-primary" aria-hidden="true" />
              Your movie life, in one nest
            </p>
            <div className="space-y-3">
              <h1 className="text-2xl font-heading font-semibold leading-tight text-mn-text-primary sm:text-3xl">
                Build a cozy watch rhythm with friends
              </h1>
              <p className="max-w-2xl text-sm text-mn-text-secondary">
                Capture what you watch, swap ideas, and let MoviNesta queue something delightful for
                tonight. The more you log, the smarter the nest feels.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                to="/diary"
                className="inline-flex items-center gap-2 rounded-full bg-mn-primary px-4 py-2 font-semibold text-mn-bg shadow-mn-soft transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                <Play className="h-4 w-4" />
                Start tonight’s pick
              </Link>
              <Link
                to="/search"
                className="inline-flex items-center gap-2 rounded-full border border-mn-border-subtle/80 bg-mn-bg/80 px-4 py-2 font-semibold text-mn-text-primary shadow-mn-soft transition hover:border-mn-primary/70 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                <Sparkles className="h-4 w-4" />
                Browse ideas
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    to={action.to}
                    className={`group relative flex h-full flex-col justify-between gap-2 overflow-hidden rounded-2xl border border-mn-border-subtle/70 bg-gradient-to-br ${action.accent} p-3 text-left shadow-mn-soft transition hover:-translate-y-0.5 hover:border-mn-primary/70`}
                  >
                    <div className="flex items-center gap-2 text-[12px] text-mn-text-muted">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-mn-bg/70 text-mn-text-secondary ring-1 ring-mn-border-subtle/70">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="font-semibold text-mn-text-primary">{action.title}</span>
                      {action.badge ? (
                        <span className="rounded-full bg-mn-bg/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mn-primary ring-1 ring-mn-border-subtle/70">
                          {action.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[12px] text-mn-text-secondary">{action.description}</p>
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-mn-text-primary transition group-hover:text-mn-primary">
                      Go now
                      <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-mn-text-muted">
                <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-1 ring-1 ring-mn-border-subtle/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-mn-primary" aria-hidden="true" />
                  At a glance
                </span>
                <span className="text-mn-text-secondary">Tiny cues to set the vibe</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {quickStats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.title}
                      className={`relative overflow-hidden rounded-2xl border border-mn-border-subtle/70 bg-gradient-to-br ${stat.accent} p-3 shadow-mn-soft`}
                    >
                      <div className="relative flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[12px] text-mn-text-muted">
                          <Icon className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
                          <span>{stat.title}</span>
                        </div>
                        <p className="text-lg font-semibold text-mn-text-primary">{stat.value}</p>
                        <p className="text-[12px] text-mn-text-secondary">{stat.hint}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative flex items-stretch">
            <div className="relative w-full overflow-hidden rounded-2xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 p-4 shadow-mn-soft">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(20,184,166,0.25),transparent_40%),radial-gradient(circle_at_80%_50%,rgba(168,85,247,0.2),transparent_42%)]"
                aria-hidden="true"
              />
              <div className="relative flex h-full flex-col justify-between gap-6">
                <div className="space-y-2">
                  <p className="inline-flex items-center gap-2 rounded-full bg-mn-bg/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-mn-text-secondary ring-1 ring-mn-border-subtle/80">
                    Tonight’s spotlight
                  </p>
                  <h2 className="text-xl font-heading font-semibold text-mn-text-primary">
                    Invite friends to co-curate
                  </h2>
                  <p className="text-[13px] text-mn-text-secondary">
                    Share your diary mood, then let friends drop in suggestions. Use the chat bubble
                    to spin up a movie night together.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    to="/messages"
                    className="group flex items-center justify-between rounded-xl border border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-2 text-[13px] font-semibold text-mn-text-primary shadow-mn-soft transition hover:border-mn-primary/70 hover:bg-mn-bg/90"
                  >
                    <span>Open messages</span>
                    <span className="text-[11px] text-mn-text-muted group-hover:text-mn-text-secondary">
                      Plan together →
                    </span>
                  </Link>
                  <Link
                    to="/diary"
                    className="group flex items-center justify-between rounded-xl border border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-2 text-[13px] font-semibold text-mn-text-primary shadow-mn-soft transition hover:border-mn-primary/70 hover:bg-mn-bg/90"
                  >
                    <span>Update diary</span>
                    <span className="text-[11px] text-mn-text-muted group-hover:text-mn-text-secondary">
                      Keep cues fresh →
                    </span>
                  </Link>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-mn-border-subtle/80 bg-mn-bg/70 px-3 py-2 text-[12px] text-mn-text-secondary">
                  <div className="h-8 w-8 rounded-lg bg-mn-bg-elevated/80 text-center text-[11px] font-semibold leading-8 text-mn-text-primary ring-1 ring-mn-border-subtle/70">
                    MN
                  </div>
                  <p>“Your nest is quiet — grab a friend and pick something comforting.”</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-lg">
            <SegmentedControl
              segments={HOME_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
              active={activeTab}
              onChange={setActiveTab}
            />
          </div>
          {activeTab === "feed" && (
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center self-end rounded-full border border-mn-border-subtle/80 bg-mn-bg-elevated/70 text-mn-text-primary shadow-mn-soft hover:border-mn-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg sm:self-auto"
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
