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

const HeroCard: React.FC<HeroCardProps> = () => {
  // No markup rendered anymore
  return null;
};

const HeroButton: React.FC<{ action: HeroAction; subtle?: boolean }> = ({
  action,
  subtle,
}) => {
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
