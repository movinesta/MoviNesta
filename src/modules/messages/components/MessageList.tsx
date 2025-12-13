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
  computeItemKey,
  firstItemIndex,
  onStartReached,
  header,
  ariaLabel,
  autoScrollOnNewLastItem,
  autoScrollBehavior,
}: MessageListProps<T>) {
  const virtuosoRef = React.useRef<VirtuosoHandle | null>(null);
  const baseIndex = Math.max(0, firstItemIndex ?? 0);

  const prevLastKeyRef = React.useRef<React.Key | null>(null);
  React.useEffect(() => {
    if (!autoScrollOnNewLastItem) return;
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
        behavior: autoScrollBehavior ?? "smooth",
      });
    });
  }, [autoScrollBehavior, autoScrollOnNewLastItem, baseIndex, computeItemKey, items]);

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

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden" role="log" aria-live="polite" aria-relevant="additions text" aria-label={ariaLabel ?? "Messages"}>
      <Virtuoso
        ref={virtuosoRef}
        data={items ?? []}
        style={{ height: "100%", width: "100%" }}
        className="px-4 pt-6"
        alignToBottom
        followOutput={followOutput}
        atBottomStateChange={onAtBottomChange}
        startReached={onStartReached}
        increaseViewportBy={400}
        firstItemIndex={baseIndex}
        computeItemKey={
          computeItemKey
            ? (index, item) => computeItemKey(index - baseIndex, item)
            : undefined
        }
        itemContent={(index, item) => itemContent(index - baseIndex, item)}
        components={
          {
            Header: () => (header ? <div className="pt-2">{header}</div> : null),
            Footer: () => (
              <div
                className="px-1 pb-2 pt-1 text-xs text-muted-foreground"
                style={{ paddingBottom: bottomPadding ?? "10rem" }}
              >
                {footer}
              </div>
            ),
          }
        }
      />
    </div>
  );
}

export default MessageList;
