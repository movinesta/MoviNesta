import React from "react";
import { Film, HeartHandshake, Sparkles } from "lucide-react";
import { MOVINESTA_LOGO_URL } from "../../constants/brand";

interface AuthLayoutProps {
  title: string;
  description: string;
  kicker?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const featureItems = [
  {
    icon: Sparkles,
    title: "Smarter discovery",
    copy: "Find films and series you actually want to watch with taste-based matches.",
  },
  {
    icon: Film,
    title: "Live your diary",
    copy: "Track watches, reactions, and trailers in one cinematic timeline.",
  },
  {
    icon: HeartHandshake,
    title: "Watch with friends",
    copy: "See what your crew is into and plan your next movie night together.",
  },
];

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  description,
  kicker = "MoviNesta",
  children,
  footer,
}) => {
  return (
    <div className="relative min-h-screen bg-mn-bg text-mn-text-primary">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(94,234,212,0.18),transparent_55%),radial-gradient(circle_at_82%_25%,rgba(94,234,212,0.16),transparent_45%),radial-gradient(circle_at_50%_85%,rgba(244,114,182,0.16),transparent_50%)]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6 rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/90 p-6 shadow-mn-card backdrop-blur">
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mn-text-muted">
                {kicker}
              </p>
              <h1 className="text-xl font-heading font-semibold text-mn-text-primary">{title}</h1>
              <p className="text-sm text-mn-text-secondary">{description}</p>
            </div>

            {children}

            {footer && (
              <div className="border-t border-mn-border-subtle/70 pt-3 text-center text-xs text-mn-text-muted">
                {footer}
              </div>
            )}
          </div>

          <aside className="hidden flex-col justify-between gap-4 rounded-3xl border border-mn-border-subtle/60 bg-mn-bg-elevated/60 p-6 shadow-mn-soft backdrop-blur lg:flex">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mn-bg/60 ring-2 ring-mn-primary/30">
                <img
                  src={MOVINESTA_LOGO_URL}
                  alt="MoviNesta logo"
                  className="h-11 w-11 rounded-xl object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mn-text-muted">
                  Cinematic, cozy, connected
                </p>
                <p className="text-sm text-mn-text-primary">Your movie life in one glowing nest.</p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-mn-border-subtle/60 bg-mn-bg/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mn-text-muted">
                Why MoviNesta
              </p>
              <div className="space-y-3">
                {featureItems.map(({ icon: Icon, title: itemTitle, copy }) => (
                  <div key={itemTitle} className="flex gap-3 rounded-xl bg-mn-bg-elevated/70 p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mn-border-subtle/40">
                      <Icon className="h-4 w-4 text-mn-primary" aria-hidden />
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-mn-text-primary">{itemTitle}</p>
                      <p className="text-[11.5px] leading-relaxed text-mn-text-secondary">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-mn-border-subtle/70 bg-mn-bg/40 p-4 text-xs text-mn-text-secondary">
              <p className="font-semibold text-mn-text-primary">Privacy-first sessions</p>
              <p className="mt-1 leading-relaxed">
                Secure authentication powered by Supabase. Passwords stay encrypted and session
                recovery links expire quickly for your safety.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
