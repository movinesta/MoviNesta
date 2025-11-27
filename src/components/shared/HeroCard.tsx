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
  size = "small",
}) => {
  const padding = size === "small" ? "p-3" : "p-5";
  const radius = "rounded-2xl";
  const actions = [secondaryAction, primaryAction].filter(Boolean) as HeroAction[];

  return (
    <section className={`${radius} border border-mn-border-strong/60 bg-mn-bg shadow-mn-soft`}>
      <div
        className={`${padding} relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="space-y-2">
          {badge ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-mn-primary ring-1 ring-inset ring-mn-border-strong/50">
              {badge}
            </span>
          ) : null}
          <div className="space-y-1.5">
            <h1 className="text-lg font-heading font-semibold leading-snug text-mn-text-primary">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-[13px] text-mn-text-secondary leading-relaxed">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:justify-end">
          {actions.map((action, index) => (
            <HeroButton
              key={`${action.label}-${index}`}
              action={action}
              subtle={index === 0 && actions.length > 1}
            />
          ))}
        </div>
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
