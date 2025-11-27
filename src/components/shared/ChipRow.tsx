import React from "react";

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
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-[12px] transition ${
              isActive
                ? "border-mn-primary bg-mn-primary/15 text-mn-text-primary"
                : "border-mn-border-subtle bg-mn-bg-elevated/70 text-mn-text-secondary hover:text-mn-text-primary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default ChipRow;
