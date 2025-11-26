import React from "react";
import { BookmarkPlus, Play, Star, WifiOff, Heart, Share2 } from "lucide-react";

const chips = ["Sci-Fi", "Thriller", "2024", "IMAX"];

const DesignShowcase: React.FC = () => {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 p-6 shadow-mn-card">
      {/* Hero */}
      <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full bg-mn-primary/10 px-3 py-1 text-xs font-medium text-mn-primary">
            New — Smart recommendations
          </p>
          <div>
            <h2 className="font-heading text-3xl font-semibold leading-tight text-mn-text-primary">
              Your movie life, in one nest.
            </h2>
            <p className="mt-1 text-sm text-mn-text-secondary">
              Build watchlists, swipe through picks, and journal every screening with cinematic
              clarity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="group inline-flex items-center gap-2 rounded-full bg-mn-primary px-4 py-2 text-sm font-semibold text-black shadow-[0_0_0_6px_rgba(249,115,22,0.18)] transition hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              <Play
                className="h-4 w-4 transition group-hover:translate-x-[2px]"
                aria-hidden="true"
              />
              Start watching
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-mn-border-subtle bg-mn-bg px-4 py-2 text-sm font-semibold text-mn-text-primary transition hover:border-mn-border-strong hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
              Save to Nest
            </button>
          </div>
        </div>
        <div className="relative mt-2 h-48 w-full overflow-hidden rounded-2xl border border-mn-border-subtle/70 bg-gradient-to-br from-mn-accent-teal/15 via-mn-bg to-mn-primary/10 shadow-inner shadow-mn-soft lg:mt-0 lg:w-72">
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.35),transparent_45%),radial-gradient(circle_at_70%_60%,rgba(34,197,94,0.32),transparent_40%)]"
            aria-hidden="true"
          />
          <div className="absolute inset-0 flex flex-col justify-between p-4">
            <div className="flex items-center gap-2 rounded-full bg-mn-bg/60 px-3 py-1 text-[11px] text-mn-text-secondary backdrop-blur">
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              Offline ready sync
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-mn-bg/70 p-3 shadow-inner backdrop-blur">
              <div>
                <p className="text-[11px] text-mn-text-muted">Tonight</p>
                <p className="text-sm font-semibold text-mn-text-primary">“Neon Horizon”</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-mn-primary/15 px-3 py-1 text-xs font-semibold text-mn-primary">
                <Star className="h-4 w-4 fill-mn-primary text-mn-primary" aria-hidden="true" />
                8.9
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Card + actions */}
      <section className="grid gap-4 md:grid-cols-[1fr_auto]">
        <article className="group relative overflow-hidden rounded-2xl border border-mn-border-subtle/80 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.08),transparent_55%),linear-gradient(135deg,rgba(5,8,26,0.9),rgba(5,8,26,0.92))] shadow-mn-soft">
          <div className="relative flex gap-4 p-4">
            <div className="aspect-[2/3] w-28 overflow-hidden rounded-xl bg-mn-bg/60">
              <img
                src="https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&w=600&q=60"
                alt="Film poster for Neon Horizon"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] group-hover:brightness-110"
                loading="lazy"
              />
            </div>
            <div className="flex flex-1 flex-col justify-between gap-3">
              <header className="space-y-1">
                <h3 className="font-heading text-xl font-semibold text-mn-text-primary">
                  Neon Horizon
                </h3>
                <p className="text-sm text-mn-text-secondary">
                  A coder-turned-detective hunts glitches in a neon-drenched city.
                </p>
              </header>
              <div className="flex flex-wrap gap-2" aria-label="Tags for Neon Horizon">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-1 text-[11px] font-semibold text-mn-text-secondary transition group-hover:border-mn-primary/70 group-hover:text-mn-text-primary"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Play trailer
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg/60 px-4 py-2 text-sm font-semibold text-mn-text-primary transition hover:border-mn-border-strong hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                  aria-pressed="false"
                >
                  <Heart className="h-4 w-4" aria-hidden="true" />
                  Like
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-mn-bg/80 px-3 py-2 text-xs font-semibold text-mn-text-secondary transition hover:border-mn-border-subtle hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                  aria-label="Share Neon Horizon"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Share
                </button>
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-r from-mn-accent-violet/20 via-transparent to-mn-accent-teal/20 px-4 py-3 text-xs text-mn-text-muted backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-mn-success" aria-hidden="true" />
              <span aria-live="polite">Synced to your diary</span>
            </div>
            <button
              type="button"
              className="rounded-full px-3 py-1 text-[11px] font-semibold text-mn-primary underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              Undo
            </button>
          </div>
        </article>

        <aside className="flex flex-col gap-3 rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/60 p-4 shadow-mn-soft">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-lg font-semibold text-mn-text-primary">Tabs</h4>
            <span className="rounded-full bg-mn-accent-violet/20 px-3 py-1 text-[11px] font-semibold text-mn-accent-violet">
              Active
            </span>
          </div>
          <nav className="flex gap-2" aria-label="Sample tabs">
            {[
              { label: "Overview", active: true },
              { label: "Cast", active: false },
              { label: "Reviews", active: false },
            ].map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={[
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg",
                  tab.active
                    ? "border-mn-primary/60 bg-mn-primary/15 text-mn-primary shadow-[0_0_0_6px_rgba(249,115,22,0.12)]"
                    : "border-mn-border-subtle/70 bg-mn-bg/80 text-mn-text-secondary hover:border-mn-border-strong hover:text-white",
                ].join(" ")}
                aria-pressed={tab.active}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/80 px-3 py-2 text-xs text-mn-text-secondary">
            Tip: Tabs use focus rings, pressed states, and 44 px touch targets to meet WCAG target
            size guidance.
          </div>
        </aside>
      </section>
    </div>
  );
};

export default DesignShowcase;
