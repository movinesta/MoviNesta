import React from "react";

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

export default HeroCard;
