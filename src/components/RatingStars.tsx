import React from "react";

type RatingStarsProps = {
  value?: number | null;
  rating?: number | null;
  max?: number;
  disabled?: boolean;
  onChange?: (next: number | null) => void;
  size?: "sm" | "md" | number;
};

export const RatingStars: React.FC<RatingStarsProps> = ({
  value,
  rating,
  max = 5,
  disabled,
  onChange,
  size = "sm",
}) => {
  const current = value ?? rating ?? 0;
  const sizeValueRaw = typeof size === "number" ? size : size === "md" ? 24 : 20;
  const sizeValue = Math.max(24, sizeValueRaw);
  const fontSize = Math.max(10, Math.round(sizeValue * 0.6));
  const baseClasses = "inline-flex items-center justify-center rounded-full border transition";

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
            style={{ width: sizeValue, height: sizeValue, fontSize }}
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
