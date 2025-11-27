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
      className={`${radius} border border-mn-border-subtle bg-mn-bg/95 shadow-sm transition hover:border-mn-border-strong/80`}
    >
      <div className={`${padding} flex flex-col gap-3`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            {badge ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-mn-primary/30 bg-mn-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mn-primary">
                {badge}
              </span>
            ) : null}
            <h1 className="text-lg font-semibold leading-snug text-mn-text-primary">{title}</h1>
            {subtitle ? (
              <p className="text-[12px] text-mn-text-secondary leading-relaxed">{subtitle}</p>
            ) : null}
          </div>

          {(primaryAction || secondaryAction) && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] sm:justify-end">
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
