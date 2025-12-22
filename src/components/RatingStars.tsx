import React from "react";

type RatingStarsProps = {
  value: number | null | undefined;
  max?: number;
  disabled?: boolean;
  onChange?: (next: number | null) => void;
  size?: "sm" | "md";
};

export const RatingStars: React.FC<RatingStarsProps> = ({
  value,
  max = 5,
  disabled,
  onChange,
  size = "sm",
}) => {
  const current = value ?? 0;

  const baseClasses =
    size === "sm"
      ? "inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs transition"
      : "inline-flex h-6 w-6 items-center justify-center rounded-full border text-sm transition";

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, idx) => {
        const v = idx + 1;
        const active = current >= v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => {
              if (!onChange || disabled) return;
              const next = current === v ? null : v;
              onChange(next);
            }}
            disabled={disabled}
            className={`${baseClasses} ${
              active
                ? "border-primary/80 bg-primary/90 text-primary-foreground"
                : "border-border bg-card/60 text-muted-foreground hover:border-primary/70 hover:text-primary/90"
            }`}
            aria-label={`Rate ${v} star${v === 1 ? "" : "s"}`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};
