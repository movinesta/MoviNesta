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
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-10">
        <div className="flex flex-col gap-6">
          <div className="space-y-6 rounded-3xl border border-border bg-card/90 p-6 shadow-lg backdrop-blur">
            <div className="space-y-2 text-left">
              <p className="type-overline text-muted-foreground">
                {kicker}
              </p>
              <h1 className="type-heading text-foreground">{title}</h1>
              <p className="type-body text-muted-foreground">{description}</p>
            </div>

            {children}

            {footer && (
              <div className="border-t border-border pt-3 text-left type-caption text-muted-foreground">
                {footer}
              </div>
            )}
          </div>

          <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card/60 p-6 shadow-md backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/60 ring-2 ring-primary/30">
                <img
                  src={MOVINESTA_LOGO_URL}
                  alt="MoviNesta logo"
                  className="h-11 w-11 rounded-xl object-contain"
                />
              </div>
              <div>
                <p className="type-overline text-muted-foreground">
                  Cinematic, cozy, connected
                </p>
                <p className="type-body text-foreground">Your movie life in one glowing nest.</p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
              <p className="type-overline text-muted-foreground">
                Why MoviNesta
              </p>
              <div className="space-y-3">
                {featureItems.map(({ icon: Icon, title: itemTitle, copy }) => (
                  <div key={itemTitle} className="flex gap-3 rounded-xl bg-card/70 p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-border/40">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                    </span>
                    <div className="space-y-0.5">
                      <p className="type-label text-foreground">{itemTitle}</p>
                      <p className="type-caption text-muted-foreground">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-background/40 p-4 type-caption text-muted-foreground">
              <p className="type-label text-foreground">Privacy-first sessions</p>
              <p className="mt-1">
                Secure authentication powered by Supabase. Passwords stay encrypted and session
                recovery links expire quickly for your safety.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
