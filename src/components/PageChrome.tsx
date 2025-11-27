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
    <header className="relative overflow-hidden rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 px-4 py-4 shadow-mn-soft">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.12),transparent_55%),radial-gradient(circle_at_85%_15%,rgba(34,197,94,0.1),transparent_45%),radial-gradient(circle_at_30%_80%,rgba(249,115,22,0.12),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className={["space-y-1", isCentered ? "text-center sm:text-left" : ""].join(" ")}>
          {kicker && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-mn-text-muted">
              {kicker}
            </p>
          )}

          <div className="flex items-center gap-2">
            {Icon && (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-mn-border-subtle/50">
                <Icon className="h-4 w-4 text-mn-text-primary" aria-hidden />
              </span>
            )}
            <h1 className="text-xl font-heading font-semibold text-mn-text-primary">{title}</h1>
            {badge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-mn-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-mn-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                <span>{badge}</span>
              </span>
            )}
          </div>

          {description && (
            <p className="max-w-3xl text-[11.5px] leading-relaxed text-mn-text-secondary">
              {description}
            </p>
          )}
        </div>

        {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
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
