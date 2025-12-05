import React from "react";

export type ChipVariant = "default" | "outline" | "accent";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

const baseClasses =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium";

const variantClasses: Record<ChipVariant, string> = {
  default: "bg-mn-bg-elevated/80 text-mn-text-secondary border border-mn-border-subtle/60",
  outline: "border border-mn-border-subtle text-mn-text-secondary bg-transparent",
  accent: "bg-mn-primary-soft/20 text-mn-primary border border-mn-primary/30",
};

export const Chip: React.FC<ChipProps> = ({ variant = "default", className = "", ...props }) => {
  const classes = [baseClasses, variantClasses[variant], className].filter(Boolean).join(" ");

  return <span className={classes} {...props} />;
};

export default Chip;
