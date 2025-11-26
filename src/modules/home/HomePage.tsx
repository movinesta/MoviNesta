import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Film,
  Sparkles,
  Users,
  Clock,
  SlidersHorizontal,
  Play,
  Compass,
  BookmarkPlus,
  BarChart3,
} from "lucide-react";
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

  const heroHighlights = [
    { label: "This week", value: "5 logs", hint: "+2 vs. last week" },
    { label: "Watchlist", value: "18 titles", hint: "3 ready to stream" },
    { label: "Friends", value: "12 online", hint: "4 new reviews" },
  ];

  const continueWatching = [
    {
      title: "Midnight Metro",
      runtime: "92m",
      progress: 65,
      backdrop:
        "https://images.unsplash.com/photo-1505685296765-3a2736de412f?auto=format&fit=crop&w=900&q=60",
    },
    {
      title: "Analog Hearts",
      runtime: "118m",
      progress: 32,
      backdrop:
        "https://images.unsplash.com/photo-1505685296765-3a2736de412f?auto=format&fit=crop&w=900&q=60&sat=-30",
    },
    {
      title: "Echoes of Neon",
      runtime: "101m",
      progress: 82,
      backdrop:
        "https://images.unsplash.com/photo-1505685296765-3a2736de412f?auto=format&fit=crop&w=900&q=60&sat=-75",
    },
  ];

  const vibePrompts = [
    {
      label: "Mood lift",
      description: "Feel-good stories under 2 hours with fresh friend buzz.",
      accent: "from-mn-accent-emerald/70 via-mn-accent-amber/50 to-mn-primary/60",
    },
    {
      label: "Late-night neon",
      description: "Stylish thrillers with synth scores and gorgeous palettes.",
      accent: "from-mn-accent-violet/60 via-mn-accent-rose/60 to-mn-primary/40",
    },
    {
      label: "Documentary sprint",
      description: "Bite-sized docs you can finish before midnight.",
      accent: "from-mn-accent-teal/60 via-mn-accent-emerald/50 to-mn-accent-amber/50",
    },
  ];

  const friendSignals = [
    {
      title: "Aria logged a 4.5 ★ for Night Chorus",
      meta: "Rewatch · 12m ago",
    },
    {
      title: "Devi added 3 picks to the Watch Together lane",
      meta: "Shared list · 45m ago",
    },
    {
      title: "Zane queued a Dolby Vision screening",
      meta: "Invite ready · 1h ago",
    },
  ];

  const quickActions = [
    {
      label: "Smart watchlist",
      description: "Prioritize titles by recency, hype, and runtime fit.",
      icon: BookmarkPlus,
      onClick: () => navigate("/diary"),
    },
    {
      label: "Discover lanes",
      description: "Jump into trending, friend picks, or fresh debuts.",
      icon: Compass,
      onClick: () => navigate("/swipe"),
    },
    {
      label: "Progress pulse",
      description: "See how your streak stacks up and celebrate wins.",
      icon: BarChart3,
      onClick: () => navigate("/diary"),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      {/* Cinematic hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-mn-border-subtle/80 bg-mn-surface/90 p-5 shadow-mn-soft">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(168,85,247,0.2),transparent_40%),radial-gradient(circle_at_70%_10%,rgba(34,197,94,0.2),transparent_35%),radial-gradient(circle_at_75%_70%,rgba(251,146,60,0.25),transparent_45%)]"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-mn-bg/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-mn-text-secondary">
              <span className="inline-flex h-2 w-2 rounded-full bg-mn-primary" aria-hidden="true" />
              Welcome back
            </p>
            <div className="space-y-2">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-heading font-semibold leading-tight text-mn-text-primary sm:text-3xl">
                <Sparkles className="h-6 w-6 text-mn-primary" aria-hidden="true" />
                Your cinematic home base
              </h1>
              <p className="max-w-2xl text-sm text-mn-text-secondary">
                Track every screening, keep watchlists tidy, and swipe through friend-powered picks.
                MoviNesta keeps the vibe cinematic while the flows stay light.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/swipe")}
                className="inline-flex items-center gap-2 rounded-full bg-mn-primary px-4 py-2 text-sm font-semibold text-black shadow-mn-glow transition hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Start swiping
              </button>
              <button
                type="button"
                onClick={() => navigate("/diary")}
                className="inline-flex items-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg/70 px-4 py-2 text-sm font-semibold text-mn-text-primary transition hover:border-mn-border-strong hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                <Clock className="h-4 w-4" aria-hidden="true" />
                Open diary
              </button>
              <button
                type="button"
                onClick={() => navigate("/search")}
                className="inline-flex items-center gap-2 rounded-full border border-transparent bg-mn-bg/70 px-4 py-2 text-sm font-semibold text-mn-text-secondary transition hover:border-mn-border-subtle hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
                Explore titles
              </button>
            </div>
            <dl className="grid gap-2 sm:grid-cols-3">
              {heroHighlights.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-2 shadow-inner"
                >
                  <dt className="text-[11px] text-mn-text-muted">{stat.label}</dt>
                  <dd className="flex items-baseline gap-1 text-base font-semibold text-mn-text-primary">
                    {stat.value}
                    <span className="text-[11px] font-medium text-mn-text-secondary">
                      {stat.hint}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mt-3 w-full max-w-sm overflow-hidden rounded-3xl border border-mn-border-subtle/70 bg-mn-bg/80 shadow-mn-card backdrop-blur">
            <div
              className="absolute inset-0 bg-[linear-gradient(120deg,rgba(251,146,60,0.12),rgba(20,184,166,0.08))]"
              aria-hidden="true"
            />
            <div className="relative space-y-3 p-4">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-mn-text-muted">
                Tonight&apos;s focus
                <span className="inline-flex items-center gap-1 rounded-full bg-mn-primary/15 px-2 py-0.5 text-[10px] font-semibold text-mn-primary">
                  <Film className="h-3 w-3" aria-hidden="true" />
                  Double feature
                </span>
              </p>
              <div className="flex gap-3">
                <div className="h-32 w-24 overflow-hidden rounded-xl bg-mn-bg/70">
                  <img
                    src="https://images.unsplash.com/photo-1542204637-e67bc7d41e28?auto=format&fit=crop&w=400&q=60"
                    alt="Poster art for Midnight Metro"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <h2 className="font-heading text-lg font-semibold text-mn-text-primary">
                    Midnight Metro
                  </h2>
                  <p className="text-[12px] leading-snug text-mn-text-secondary">
                    A neon thrill ride across a sleepless city. Tap to jump into details or queue it
                    for later.
                  </p>
                  <div className="flex flex-wrap gap-1" aria-label="Tonight's tags">
                    {["Neo-noir", "92m", "Dolby Vision"].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-mn-bg/80 px-2 py-0.5 text-[11px] font-semibold text-mn-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/title/midnight-metro")}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  View details
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/diary")}
                  className="inline-flex items-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-1.5 text-xs font-semibold text-mn-text-primary transition hover:border-mn-border-strong hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                >
                  <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                  Queue it
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Continue watching rail */}
      <section className="space-y-2 rounded-[22px] border border-mn-border-subtle/70 bg-mn-bg-elevated/70 p-3 shadow-mn-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 sm:px-0">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mn-text-muted">
              Continue watching
            </p>
            <p className="text-sm text-mn-text-secondary">
              Jump back into unfinished titles without losing your spot.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/diary")}
            className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle px-3 py-1 text-[11px] font-semibold text-mn-text-primary hover:border-mn-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          >
            View queue
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {continueWatching.map((item) => (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/70 shadow-mn-soft"
            >
              <div className="absolute inset-0 opacity-60 group-hover:opacity-80">
                <img
                  src={item.backdrop}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="relative space-y-2 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-mn-text-muted">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.runtime}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-heading font-semibold text-mn-text-primary">
                    {item.title}
                  </h3>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2.5 py-1 text-[11px] font-semibold text-mn-text-secondary transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                  >
                    Resume
                  </button>
                </div>
                <div
                  className="h-2 rounded-full bg-mn-border-subtle/60"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mn-primary via-mn-accent-amber to-mn-accent-emerald"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Vibe prompts */}
      <section className="grid gap-3 md:grid-cols-3">
        {vibePrompts.map((vibe) => (
          <button
            key={vibe.label}
            type="button"
            className="group flex h-full flex-col items-start gap-2 overflow-hidden rounded-3xl border border-mn-border-subtle/70 bg-mn-surface/80 p-4 text-left shadow-mn-soft transition hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          >
            <span
              aria-hidden="true"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${vibe.accent} text-black shadow-mn-glow`}
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">{vibe.label}</p>
              <p className="text-[12px] leading-snug text-mn-text-secondary">{vibe.description}</p>
            </div>
            <span className="text-[11px] font-semibold text-mn-primary underline-offset-4 group-hover:underline">
              Build this lane
            </span>
          </button>
        ))}
      </section>

      {/* Friend signals */}
      <section className="rounded-[22px] border border-mn-border-subtle/70 bg-mn-bg-elevated/70 p-4 shadow-mn-soft">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-mn-text-muted">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Friend signals
        </div>
        <ul className="space-y-2" aria-label="Recent friend activity">
          {friendSignals.map((signal, index) => (
            <li
              key={signal.title}
              className="flex items-start justify-between gap-2 rounded-2xl border border-mn-border-subtle/60 bg-mn-bg/70 px-3 py-2 shadow-inner transition hover:border-mn-border-strong"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-mn-text-primary">{signal.title}</p>
                <p className="text-[11px] text-mn-text-secondary">{signal.meta}</p>
              </div>
              <span className="rounded-full bg-mn-bg-elevated/80 px-2 py-1 text-[10px] font-semibold text-mn-text-secondary">
                {index === 0 ? "Now" : "See"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Quick flows */}
      <section className="grid gap-3 md:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="group flex h-full flex-col items-start gap-2 rounded-2xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 p-3 text-left shadow-mn-soft transition hover:-translate-y-[1px] hover:border-mn-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/70 px-2 py-1 text-[11px] font-semibold text-mn-text-secondary">
                <Icon className="h-3.5 w-3.5 text-mn-primary" aria-hidden="true" />
                {action.label}
              </span>
              <p className="text-[12px] leading-snug text-mn-text-secondary group-hover:text-mn-text-primary">
                {action.description}
              </p>
              <span className="text-[11px] font-semibold text-mn-primary underline-offset-4 group-hover:underline">
                Open
              </span>
            </button>
          );
        })}
      </section>

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
