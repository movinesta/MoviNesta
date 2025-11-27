import React from "react";

interface Segment<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  active: T;
  onChange: (key: T) => void;
}

const SegmentedControl = <T extends string>({ segments, active, onChange }: SegmentedControlProps<T>) => {
  return (
    <div
      className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg-elevated/70 p-1 text-[12px] shadow-mn-soft"
      role="tablist"
    >
      {segments.map((segment) => {
        const isActive = active === segment.key;
        return (
          <button
            key={segment.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(segment.key)}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium transition ${
              isActive
                ? "bg-mn-primary text-mn-bg shadow-mn-soft"
                : "text-mn-text-secondary hover:bg-mn-bg/60"
            }`}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
