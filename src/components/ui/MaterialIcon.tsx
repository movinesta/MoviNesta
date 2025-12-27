import React from "react";

type MaterialIconProps = {
  /** Material Symbols Rounded icon name, e.g. "close", "favorite", "bookmark_add" */
  name: string;
  className?: string;
  /** Use filled style (FILL=1). Default false. */
  filled?: boolean;
  /** Optional accessible label. If omitted, icon is aria-hidden. */
  ariaLabel?: string;
};

/**
 * Material Symbols Rounded icon.
 * Requires the font import in src/index.css.
 */
export function MaterialIcon({ name, className, filled, ariaLabel }: MaterialIconProps) {
  return (
    <span
      className={["material-symbols-rounded", filled ? "is-filled" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
    >
      {name}
    </span>
  );
}
