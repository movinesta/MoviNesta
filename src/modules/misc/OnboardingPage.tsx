import React from "react";
import { Link } from "react-router-dom";
import { Film, HeartHandshake, Sparkles } from "lucide-react";
import { MOVINESTA_LOGO_URL } from "../../constants/brand";

const OnboardingPage: React.FC = () => {
  return (
    <div className="relative flex min-h-screen flex-col bg-mn-bg text-mn-text-primary">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(94,234,212,0.16),transparent_48%),radial-gradient(circle_at_82%_18%,rgba(94,234,212,0.18),transparent_42%),radial-gradient(circle_at_50%_82%,rgba(244,114,182,0.16),transparent_52%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-8 rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 p-8 shadow-mn-card backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mn-bg/70 ring-2 ring-mn-primary/30">
                <img
                  src={MOVINESTA_LOGO_URL}
                  alt="MoviNesta logo"
                  className="h-11 w-11 rounded-xl object-contain"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mn-text-muted">
                  MoviNesta
                </p>
                <p className="text-sm text-mn-text-secondary">Cinematic, cozy, and connected.</p>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-heading font-semibold leading-tight">
                Your movie life, in one nest.
              </h1>
              <p className="text-sm text-mn-text-secondary">
                MoviNesta keeps your watchlist, recommendations, and movie memories in a single
                cozy, cinematic space. Swipe to discover, log what you watch, and see what your
                friends are into.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                to="/auth/signup"
                className="inline-flex min-w-[200px] items-center justify-center rounded-full bg-mn-primary px-6 py-3 text-sm font-semibold text-black shadow-mn-soft transition hover:bg-mn-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                Get started
              </Link>

              <Link
                to="/auth/signin"
                className="text-sm font-medium text-mn-text-secondary underline-offset-4 transition hover:text-mn-primary hover:underline"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/60 p-6 shadow-mn-soft backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mn-text-muted">
              What you can do
            </p>
            <div className="space-y-3">
              {[
                {
                  icon: Sparkles,
                  title: "Discover faster",
                  copy: "Swipe through curated picks and matches tailored to your taste.",
                },
                {
                  icon: Film,
                  title: "Log every watch",
                  copy: "Keep a beautiful diary of what you&apos;ve seen with ratings and reactions.",
                },
                {
                  icon: HeartHandshake,
                  title: "Watch with friends",
                  copy: "Follow your crew, trade lists, and plan your next movie night together.",
                },
              ].map(({ icon: Icon, title, copy }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl bg-mn-bg/60 p-4">
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-mn-border-subtle/50">
                    <Icon className="h-5 w-5 text-mn-primary" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-mn-text-primary">{title}</p>
                    <p className="text-[11.5px] leading-relaxed text-mn-text-secondary">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
