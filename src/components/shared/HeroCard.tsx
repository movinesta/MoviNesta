import React from "react";
import { Button } from "../ui/Button";

interface HeroAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "ghost";
}

interface HeroCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  primaryAction?: HeroAction;
  secondaryAction?: HeroAction;
  size?: "large" | "small";
}

const HeroCard: React.FC<HeroCardProps> = ({
  title,
  subtitle,
  badge,
  primaryAction,
  secondaryAction,
  size = "large",
}) => {
  const padding = size === "small" ? "p-4" : "p-5";
  const radius = "rounded-2xl";

  return (
    <section
      className={`${radius} relative overflow-hidden border border-mn-border-subtle/70 bg-mn-bg/80 shadow-mn-card backdrop-blur`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(249,115,22,0.12),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(34,197,94,0.1),transparent_55%)]"
        aria-hidden
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mn-primary/30 to-transparent" aria-hidden />
      <div className={`${padding} relative flex flex-col gap-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {badge ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-mn-primary/40 bg-mn-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mn-primary shadow-sm">
                {badge}
              </span>
            ) : null}
            <h1 className="text-xl font-semibold leading-snug text-mn-text-primary drop-shadow-sm">{title}</h1>
            {subtitle ? <p className="text-[12px] text-mn-text-secondary leading-relaxed">{subtitle}</p> : null}
          </div>
          {(primaryAction || secondaryAction) && (
            <div className="flex flex-col items-end gap-2 text-[11px] sm:flex-row sm:items-center">
              {secondaryAction ? <HeroButton action={secondaryAction} subtle /> : null}
              {primaryAction ? <HeroButton action={primaryAction} /> : null}
            </div>
          )}
        </div>

        {secondaryAction && !primaryAction ? (
          <div className="flex gap-2">
            <HeroButton action={secondaryAction} subtle />
          </div>
        ) : null}
      </div>
    </section>
  );
};

const HeroButton: React.FC<{ action: HeroAction; subtle?: boolean }> = ({ action, subtle }) => {
  const handleClick = (event: React.MouseEvent) => {
    if (action.href) return;
    event.preventDefault();
    action.onClick?.();
  };

  const variant = action.variant ?? (subtle ? "ghost" : "default");

  if (action.href) {
    return (
      <a href={action.href} onClick={handleClick} className="inline-flex">
        <Button variant={variant} size="sm">
          {action.label}
        </Button>
      </a>
    );
  }

  return (
    <Button variant={variant} size="sm" onClick={handleClick}>
      {action.label}
    </Button>
  );
};

export default HeroCard;
