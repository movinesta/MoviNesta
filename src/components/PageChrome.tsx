import React from "react";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  kicker?: string;
  badge?: string;
  actions?: React.ReactNode;
  alignment?: "left" | "center";
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  kicker,
  badge,
  actions,
  alignment = "left",
}) => {
  const isCentered = alignment === "center";

  return (
    <header className="relative overflow-hidden rounded-3xl border border-mn-border-strong/40 bg-mn-bg/80 px-5 py-5 shadow-mn-card backdrop-blur">
      <div className="pointer-events-none absolute inset-x-4 top-2 h-[1px] bg-gradient-to-r from-transparent via-mn-primary/40 to-transparent" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className={["space-y-2", isCentered ? "text-center sm:text-left" : ""].join(" ")}>
          <div className="flex flex-wrap items-center gap-3">
            {Icon && (
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-mn-primary/15 via-mn-bg to-mn-bg-elevated text-mn-text-primary ring-1 ring-inset ring-mn-border-strong/50">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
            )}
            <div className="space-y-1">
              {kicker && (
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-mn-text-muted">
                  <span className="h-1 w-6 rounded-full bg-mn-border-strong/70" aria-hidden />
                  {kicker}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-heading font-semibold text-mn-text-primary">{title}</h1>
                {badge && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-mn-primary/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-mn-primary ring-1 ring-inset ring-mn-border-strong/50">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    <span>{badge}</span>
                  </span>
                )}
              </div>
              {description && (
                <p className="max-w-3xl text-[12.5px] leading-relaxed text-mn-text-secondary/90">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center justify-end gap-2 text-[12px] text-mn-text-secondary">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};

interface PageSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "default" | "muted";
  padded?: boolean;
}

export const PageSection: React.FC<PageSectionProps> = ({
  title,
  description,
  children,
  actions,
  tone = "default",
  padded = true,
}) => {
  const surfaceClassName =
    tone === "muted"
      ? "rounded-2xl border border-dashed border-mn-border-subtle/70 bg-mn-bg-elevated/50"
      : "rounded-2xl border border-mn-border-subtle/70 bg-mn-bg-elevated/70 shadow-mn-soft";

  return (
    <section className={[surfaceClassName, padded ? "p-4" : "p-0"].join(" ")}>
      {(title || description || actions) && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title && (
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">{title}</h2>
            )}
            {description && <p className="text-[11px] text-mn-text-secondary">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {children}
    </section>
  );
};
