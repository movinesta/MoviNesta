import React from "react";

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  as?: "div" | "section" | "article";
}

export const Card: React.FC<CardProps> = ({
  padded = true,
  as: Component = "div",
  className = "",
  ...props
}) => {
  const base =
    "rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated shadow-mn-card";
  const padding = padded ? "p-4" : "";

  const classes = [base, padding, className].filter(Boolean).join(" ");

  return <Component className={classes} {...props} />;
};

export default Card;
