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
  const padding = size === "small" ? "p-4" : "p-6";
  const radius = "rounded-3xl";

  return (
    <section
      className={`${radius} relative overflow-hidden border border-mn-border-strong/40 bg-gradient-to-r from-mn-bg to-mn-bg-elevated/80 shadow-mn-card backdrop-blur`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-10 top-0 h-24 w-24 rounded-full bg-mn-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-28 w-28 rounded-full bg-mn-primary-soft blur-3xl" />
      </div>

      <div
        className={`${padding} relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="space-y-2">
          {badge ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-mn-primary ring-1 ring-inset ring-mn-border-strong/50">
              {badge}
            </span>
          ) : null}
          <div className="space-y-1.5">
            <h1 className="text-xl font-heading font-semibold leading-snug text-mn-text-primary">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-[13px] text-mn-text-secondary leading-relaxed">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:justify-end">
            {secondaryAction ? <HeroButton action={secondaryAction} subtle /> : null}
            {primaryAction ? <HeroButton action={primaryAction} /> : null}
          </div>
        )}
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
