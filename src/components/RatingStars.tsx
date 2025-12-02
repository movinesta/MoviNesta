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
      ? "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition"
      : "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[13px] transition";

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
                ? "border-mn-primary/80 bg-mn-primary/90 text-mn-bg"
                : "border-mn-border-subtle/70 bg-mn-bg-elevated/60 text-mn-text-muted hover:border-mn-primary/70 hover:text-mn-primary/90"
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
