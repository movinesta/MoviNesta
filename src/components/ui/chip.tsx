import React from "react";

export type ChipVariant = "default" | "outline" | "accent";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

const baseClasses = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";

const variantClasses: Record<ChipVariant, string> = {
  default: "bg-card/80 text-muted-foreground border border-border",
  outline: "border border-border text-muted-foreground bg-transparent",
  accent: "bg-primary/20 text-primary border border-primary/30",
};

export const Chip: React.FC<ChipProps> = ({ variant = "default", className = "", ...props }) => {
  const classes = [baseClasses, variantClasses[variant], className].filter(Boolean).join(" ");

  return <span className={classes} {...props} />;
};

export default Chip;
