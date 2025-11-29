import React from "react";
import { Loader2, Sparkles } from "lucide-react";

interface FullScreenLoaderProps {
  title: string;
  message?: string;
  badge?: string;
  children?: React.ReactNode;
}

const AuroraBackdrop: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(79,70,229,0.18),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(248,113,113,0.16),transparent_32%),radial-gradient(circle_at_18%_78%,rgba(34,197,94,0.12),transparent_36%),radial-gradient(circle_at_86%_74%,rgba(14,165,233,0.14),transparent_40%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(20,184,166,0.08),rgba(168,85,247,0.07)_40%,rgba(249,115,22,0.08)_80%)]" />
    <div className="absolute -left-28 top-12 h-72 w-72 rounded-full bg-gradient-to-br from-mn-accent-teal/20 via-mn-primary/10 to-mn-accent-violet/10 blur-3xl" />
    <div className="absolute -right-28 bottom-10 h-80 w-80 rounded-full bg-gradient-to-tr from-mn-primary/25 via-amber-500/10 to-mn-accent-violet/15 blur-3xl" />
    <div className="absolute left-10 top-20 h-44 w-px bg-gradient-to-b from-mn-primary/60 via-mn-accent-teal/20 to-transparent opacity-60" />
    <div className="absolute right-16 bottom-32 h-44 w-px bg-gradient-to-b from-mn-accent-violet/70 via-mn-primary/20 to-transparent opacity-70" />
  </div>
);

const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({ title, message, badge, children }) => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-mn-bg text-mn-text-primary">
      <AuroraBackdrop />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-10 text-center sm:px-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-mn-text-secondary ring-1 ring-inset ring-white/10 shadow-mn-soft">
          <Sparkles className="h-4 w-4 text-mn-primary" aria-hidden="true" />
          <span>{badge ?? "Tuning your MoviNesta vibe"}</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-heading font-semibold tracking-tight text-mn-text-primary sm:text-4xl">{title}</h1>
          {message && (
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-mn-text-secondary sm:text-base">
              {message}
            </p>
          )}
        </div>

        <div className="w-full max-w-2xl space-y-4 rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/70 p-6 text-left shadow-mn-card backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mn-accent-teal/40 via-mn-primary/30 to-mn-accent-violet/30 text-mn-text-primary shadow-mn-soft">
              <Loader2 className="h-5 w-5 animate-spin text-mn-bg" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-mn-text-primary">Setting the scene</p>
              <p className="text-[12px] text-mn-text-secondary">Polishing the interface and warming up your recommendations.</p>
            </div>
          </div>

          <div className="relative h-2 w-full overflow-hidden rounded-full bg-mn-border-subtle/40">
            <span className="absolute inset-y-0 left-0 w-1/2 animate-[shimmer_1.6s_ease_in_out_infinite] rounded-full bg-gradient-to-r from-mn-accent-teal via-mn-primary to-mn-accent-violet" />
          </div>

          {children && <div className="pt-2">{children}</div>}
        </div>
      </div>
    </div>
  );
};

export default FullScreenLoader;
