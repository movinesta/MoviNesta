import React, { useMemo, useRef } from "react";

interface Segment<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  active: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
  idPrefix?: string;
  getPanelId?: (key: T) => string;
}

const SegmentedControl = <T extends string>({
  segments,
  active,
  onChange,
  ariaLabel,
  idPrefix,
  getPanelId,
}: SegmentedControlProps<T>) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const segmentLookup = useMemo(
    () =>
      segments.map((segment, index) => ({
        ...segment,
        index,
      })),
    [segments],
  );

  const focusTabAtIndex = (index: number) => {
    const tab = tabRefs.current[index];
    tab?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const lastIndex = segments.length - 1;
    let nextIndex = currentIndex;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextKey = segments[nextIndex]?.key;
    if (nextKey) {
      onChange(nextKey);
      focusTabAtIndex(nextIndex);
    }
  };

  return (
    <div
      className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg-elevated/70 p-1 text-[12px] shadow-mn-soft"
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
    >
      {segmentLookup.map((segment) => {
        const isActive = active === segment.key;
        const tabId = idPrefix ? `${idPrefix}-${segment.key}` : undefined;
        const panelId = getPanelId?.(segment.key);

        return (
          <button
            key={segment.key}
            id={tabId}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId}
            onClick={() => onChange(segment.key)}
            onKeyDown={(event) => handleKeyDown(event, segment.index)}
            ref={(node) => {
              tabRefs.current[segment.index] = node;
            }}
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
