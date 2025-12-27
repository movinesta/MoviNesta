import React from "react";
import { Chip } from "@/components/ui/Chip";

interface ChipOption<T extends string> {
  key: T;
  label: string;
}

interface ChipRowProps<T extends string> {
  options: ChipOption<T>[];
  active: T;
  onChange: (key: T) => void;
}

const ChipRow = <T extends string>({ options, active, onChange }: ChipRowProps<T>) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {options.map((option) => {
        const isActive = option.key === active;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={isActive}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Chip variant={isActive ? "accent" : "outline"} className="whitespace-nowrap">
              {option.label}
            </Chip>
          </button>
        );
      })}
    </div>
  );
};

export default ChipRow;
