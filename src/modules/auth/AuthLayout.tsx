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
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.12),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.2),_transparent_50%)]" />
        <div className="flex flex-col gap-6">
          <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-8 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-none">
            <div className="space-y-2 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {kicker}
              </p>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
                {title}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
            </div>

            {children}

            {footer && (
              <div className="border-t border-slate-200 pt-3 text-left text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                {footer}
              </div>
            )}
          </div>

          <section className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 ring-2 ring-primary/30 dark:bg-slate-900/70">
                <img
                  src={MOVINESTA_LOGO_URL}
                  alt="MoviNesta logo"
                  className="h-11 w-11 rounded-xl object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Cinematic, cozy, connected
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Your movie life in one glowing nest.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Why MoviNesta
              </p>
              <div className="space-y-3">
                {featureItems.map(({ icon: Icon, title: itemTitle, copy }) => (
                  <div
                    key={itemTitle}
                    className="flex gap-3 rounded-xl border border-slate-200/60 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-slate-900/70"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">
                        {itemTitle}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white/60 p-4 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400">
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                Privacy-first sessions
              </p>
              <p className="mt-1 text-xs leading-relaxed">
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
