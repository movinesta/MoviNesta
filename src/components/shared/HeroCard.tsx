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
      className={`${radius} relative overflow-hidden border border-mn-border-subtle/70 bg-gradient-to-br from-mn-bg via-mn-bg/95 to-mn-bg shadow-mn-card`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.12),_transparent_45%),_radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.1),_transparent_40%)]"
        aria-hidden
      />
      <div className={`${padding} relative flex flex-col gap-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {badge ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-mn-primary/40 bg-mn-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mn-primary">
                {badge}
              </span>
            ) : null}
            <h1 className="text-xl font-semibold leading-snug text-mn-text-primary">{title}</h1>
            {subtitle ? <p className="text-[12px] text-mn-text-secondary">{subtitle}</p> : null}
          </div>
          {primaryAction ? (
            <div className="flex flex-col items-end gap-2 text-[11px]">
              <HeroButton action={primaryAction} />
              {secondaryAction ? <HeroButton action={secondaryAction} subtle /> : null}
            </div>
          ) : null}
        </div>

        {!primaryAction && secondaryAction ? (
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
