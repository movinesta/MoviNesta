import React from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

interface MessageListProps<T> {
  items?: T[];
  itemContent: (index: number, item: T) => React.ReactNode;
  isLoading?: boolean;
  loadingContent?: React.ReactNode;
  errorContent?: React.ReactNode;
  emptyContent?: React.ReactNode;
  footer?: React.ReactNode;
  bottomPadding?: string | number;
  followOutput?: "smooth" | boolean;
  onAtBottomChange?: (atBottom: boolean) => void;
  /**
   * Pixel threshold from the bottom of the list that still counts as "at bottom".
   * This is important for chat UIs that render a fixed composer (we add footer padding
   * so the last message stays visible above the composer).
   */
  atBottomThreshold?: number;
  computeItemKey?: (index: number, item: T) => React.Key;
  /**
   * Used to keep scroll position stable when prepending items (Virtuoso "firstItemIndex" feature).
   * If set, indices passed to itemContent/computeItemKey are normalized back to the data-array index.
   */
  firstItemIndex?: number;
  onStartReached?: () => void;
  header?: React.ReactNode;
  ariaLabel?: string;

  /**
   * Force-scroll to the bottom when a new item is appended (detected via a change
   * in the last item's key).
   *
   * Useful when you want chat-style "always stay at bottom" behavior even if the
   * user has scrolled up.
   */
  autoScrollOnNewLastItem?: boolean;
  autoScrollBehavior?: ScrollBehavior;

  /**
   * Explicit toggle for the auto-scroll effect. Useful for disabling the jump
   * when the user is intentionally reading older content (e.g. scrolled away
   * from the bottom) while still keeping the "new item" detection logic.
   */
  autoScrollEnabled?: boolean;

  /**
   * Optional external ref to control the underlying Virtuoso instance
   * (e.g. to imperatively scroll to the bottom).
   */
  virtuosoRef?: React.MutableRefObject<VirtuosoHandle | null>;
}

export function MessageList<T>({
  items = [],
  itemContent,
  isLoading,
  loadingContent,
  errorContent,
  emptyContent,
  footer,
  bottomPadding,
  followOutput = false,
  onAtBottomChange,
  atBottomThreshold,
  computeItemKey,
  firstItemIndex,
  onStartReached,
  header,
  ariaLabel,
  autoScrollOnNewLastItem,
  autoScrollBehavior,
  autoScrollEnabled = true,
  virtuosoRef: externalVirtuosoRef,
}: MessageListProps<T>) {
  const internalVirtuosoRef = React.useRef<VirtuosoHandle | null>(null);
  const virtuosoRef = externalVirtuosoRef ?? internalVirtuosoRef;
  const baseIndex = Math.max(0, firstItemIndex ?? 0);

  const scrollerElRef = React.useRef<HTMLDivElement | null>(null);
  const atBottomComputedRef = React.useRef<boolean | null>(null);

  const computeAtBottom = React.useCallback(() => {
    const el = scrollerElRef.current;
    if (!el) return;
    const threshold = typeof atBottomThreshold === "number" ? atBottomThreshold : 80;
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const next = distance <= threshold;
    if (atBottomComputedRef.current === next) return;
    atBottomComputedRef.current = next;
    onAtBottomChange?.(next);
  }, [atBottomThreshold, onAtBottomChange]);

  // Recompute when data changes (helps when Virtuoso doesn't emit atBottomStateChange due to padding).
  React.useEffect(() => {
    computeAtBottom();
  }, [computeAtBottom, items?.length]);

  const prevLastKeyRef = React.useRef<React.Key | null>(null);
  React.useEffect(() => {
    if (!autoScrollOnNewLastItem || !autoScrollEnabled) return;
    if (!items || items.length === 0) return;

    const lastIndex = items.length - 1;
    const lastItem = items[lastIndex];
    const lastKey = computeItemKey ? computeItemKey(lastIndex, lastItem) : lastIndex;

    const prevLastKey = prevLastKeyRef.current;
    prevLastKeyRef.current = lastKey;

    // Only scroll when the last item changed (prepending older pages keeps the last key stable).
    if (prevLastKey == null || prevLastKey === lastKey) return;

    // Virtuoso needs to settle layout first; scroll on next frame.
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({
        index: baseIndex + lastIndex,
        align: "end",
        behavior: (autoScrollBehavior ?? "smooth") as any,
      });
    });
  }, [
    autoScrollBehavior,
    autoScrollOnNewLastItem,
    autoScrollEnabled,
    baseIndex,
    computeItemKey,
    items,
  ]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-4 text-sm">
        {loadingContent}
      </div>
    );
  }

  if (errorContent) {
    return <div className="flex flex-1 flex-col px-4 py-4 text-sm">{errorContent}</div>;
  }

  if (!(items?.length ?? 0)) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-4 text-sm">
        {emptyContent}
      </div>
    );
  }

  const Scroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => (
      <div
        {...props}
        ref={(node) => {
          scrollerElRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        onScroll={(event) => {
          // eslint-disable-next-line react/prop-types
          props.onScroll?.(event as any);
          computeAtBottom();
        }}
      />
    ),
  );
  Scroller.displayName = "MessageListScroller";

  return (
    <div
      className="relative flex min-h-0 flex-1 overflow-hidden"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label={ariaLabel ?? "Messages"}
    >
      <Virtuoso
        ref={virtuosoRef}
        data={items ?? []}
        style={{ height: "100%", width: "100%" }}
        className="scrollbar-hide px-4 pt-4"
        alignToBottom
        followOutput={followOutput}
        atBottomStateChange={onAtBottomChange}
        atBottomThreshold={atBottomThreshold}
        startReached={onStartReached}
        increaseViewportBy={400}
        firstItemIndex={baseIndex}
        computeItemKey={
          computeItemKey ? (index, item) => computeItemKey(index - baseIndex, item) : undefined
        }
        itemContent={(index, item) => itemContent(index - baseIndex, item)}
        components={{
          Scroller,
          Header: () => (header ? <div className="pt-2">{header}</div> : null),
          Footer: () => (
            <div
              className="px-1 pb-2 pt-1 text-xs text-muted-foreground"
              style={{ paddingBottom: bottomPadding ?? "10rem" }}
            >
              {footer}
            </div>
          ),
        }}
      />
    </div>
  );
}

export default MessageList;
