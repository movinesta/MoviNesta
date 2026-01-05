import React from "react";

export type FollowOutputValue = "smooth" | boolean;
export type FollowOutputFn = (isAtBottom: boolean) => FollowOutputValue;

type ScrollerRefProp =
  | React.MutableRefObject<HTMLDivElement | null>
  | ((node: HTMLDivElement | null) => void);

interface MessageListProps<T> {
  items?: T[];
  itemContent: (index: number, item: T) => React.ReactNode;
  isLoading?: boolean;
  loadingContent?: React.ReactNode;
  errorContent?: React.ReactNode;
  emptyContent?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  bottomPadding?: string;
  scrollerRef?: ScrollerRefProp;
  followOutput?: FollowOutputValue | FollowOutputFn;
  onAtBottomChange?: (atBottom: boolean) => void;
  atBottomThreshold?: number;
  onStartReached?: () => void;
  computeItemKey?: (index: number, item: T) => React.Key;
  ariaLabel?: string;

  // Legacy props kept for backwards compatibility.
  firstItemIndex?: number;
  virtuosoRef?: unknown;
  autoScrollOnNewLastItem?: boolean;
  autoScrollBehavior?: ScrollBehavior;
  autoScrollEnabled?: boolean;
}

export function MessageList<T>(props: MessageListProps<T>) {
  const {
    items = [],
    itemContent,
    isLoading,
    loadingContent,
    errorContent,
    emptyContent,
    header,
    footer,
    bottomPadding,
    scrollerRef,
    followOutput,
    onAtBottomChange,
    atBottomThreshold = 80,
    onStartReached,
    computeItemKey,
    ariaLabel = "Messages",
  } = props;

  const internalScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const atBottomRef = React.useRef(true);
  const lastAtBottomRef = React.useRef<boolean | null>(null);
  const topLockRef = React.useRef(false);

  const setScrollerNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      internalScrollerRef.current = node;
      if (!scrollerRef) return;
      if (typeof scrollerRef === "function") {
        scrollerRef(node);
      } else {
        // eslint-disable-next-line react-hooks/immutability -- refs are intended to be mutable.
        scrollerRef.current = node;
      }
    },
    [scrollerRef],
  );

  const computeAtBottom = React.useCallback(
    (el: HTMLDivElement) => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      return dist <= atBottomThreshold;
    },
    [atBottomThreshold],
  );

  React.useLayoutEffect(() => {
    const el = internalScrollerRef.current;
    if (!el) return;

    const notifyAtBottom = (next: boolean) => {
      atBottomRef.current = next;
      if (lastAtBottomRef.current === next) return;
      lastAtBottomRef.current = next;
      onAtBottomChange?.(next);
    };

    const handleScroll = () => {
      const atBottom = computeAtBottom(el);
      notifyAtBottom(atBottom);

      // Simple "start reached" trigger (used for loading older messages).
      if (onStartReached) {
        if (el.scrollTop <= 24) {
          if (!topLockRef.current) {
            topLockRef.current = true;
            onStartReached();
          }
        } else if (el.scrollTop >= 80) {
          topLockRef.current = false;
        }
      }
    };

    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [computeAtBottom, onAtBottomChange, onStartReached]);

  // Optional "follow output" (stay pinned to bottom).
  React.useEffect(() => {
    const el = internalScrollerRef.current;
    if (!el) return;

    const atBottom = atBottomRef.current;
    const resolved =
      typeof followOutput === "function" ? followOutput(atBottom) : (followOutput ?? false);

    if (!resolved) return;
    if (!atBottom) return;

    requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: resolved === "smooth" ? "smooth" : "auto",
      });
    });
    // We purposely follow changes in list length only.
  }, [items.length]);

  if (isLoading) {
    return <div className="flex h-full w-full items-center justify-center">{loadingContent}</div>;
  }

  if (errorContent) {
    return <div className="flex h-full w-full items-center justify-center">{errorContent}</div>;
  }

  if (!items.length) {
    return <div className="flex h-full w-full items-center justify-center">{emptyContent}</div>;
  }

  return (
    <div className="h-full w-full">
      <div
        ref={setScrollerNode}
        className="h-full w-full overflow-y-auto overscroll-contain scrollbar-hide"
        role="log"
        aria-label={ariaLabel}
        style={{ paddingBottom: bottomPadding ?? undefined }}
      >
        <div className="px-4 pt-3">
          {header}
          <div className="space-y-0">
            {items.map((item, index) => (
              <React.Fragment key={computeItemKey ? computeItemKey(index, item) : index}>
                {itemContent(index, item)}
              </React.Fragment>
            ))}
          </div>
          {footer}
        </div>
      </div>
    </div>
  );
}
