import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "subtle";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseClasses =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium tracking-tight " +
  "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-mn-primary text-mn-bg shadow-mn-soft hover:bg-mn-primary/90",
  secondary:
    "bg-mn-bg-elevated text-mn-text-primary border border-mn-border-subtle hover:border-mn-primary/70",
  ghost:
    "bg-transparent text-mn-text-secondary border border-transparent hover:bg-mn-bg-elevated/60",
  subtle:
    "bg-mn-bg-elevated/80 text-mn-text-secondary border border-mn-border-subtle/60 hover:border-mn-border-strong",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-[10px]",
  sm: "h-8 px-3 text-[11px]",
  md: "h-9 px-4 text-[12px]",
  lg: "h-10 px-5 text-[13px]",
  icon: "h-9 w-9 text-[12px]",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}) => {
  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} {...props} />;
};

export default Button;
