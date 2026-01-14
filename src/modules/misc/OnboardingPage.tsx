import React from "react";
import { Link } from "react-router-dom";
import { Film, HeartHandshake, Sparkles } from "lucide-react";
import { MOVINESTA_LOGO_URL } from "../../constants/brand";

const OnboardingPage: React.FC = () => {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12">
        <div className="flex flex-col gap-8">
          <div className="space-y-8 rounded-3xl border border-border bg-card/80 p-8 shadow-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/70 ring-2 ring-primary/30">
                <img
                  src={MOVINESTA_LOGO_URL}
                  alt="MoviNesta logo"
                  className="h-11 w-11 rounded-xl object-contain"
                />
              </div>
              <div className="space-y-1">
                <p className="type-overline text-muted-foreground">MoviNesta</p>
                <p className="type-caption text-muted-foreground">
                  Cinematic, cozy, and connected.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="type-display text-foreground">Your movie life, in one nest.</h1>
              <p className="type-body text-muted-foreground">
                MoviNesta keeps your watchlist, recommendations, and movie memories in a single
                cozy, cinematic space. Swipe to discover, log what you watch, and see what your
                friends are into.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3">
              <Link
                to="/auth/signup"
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-black shadow-md transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Get started
              </Link>

              <Link
                to="/auth/signin"
                className="w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-primary hover:underline"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-border bg-card/60 p-6 shadow-md backdrop-blur">
            <p className="type-overline text-muted-foreground">What you can do</p>
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
                  copy: "Follow your crew, swap recommendations, and plan your next movie night together.",
                },
              ].map(({ icon: Icon, title, copy }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-2xl bg-background/60 p-4"
                >
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-border/50">
                    <Icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <p className="type-label text-foreground">{title}</p>
                    <p className="type-caption text-muted-foreground">{copy}</p>
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
