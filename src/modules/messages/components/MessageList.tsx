import React from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

interface MessageListProps<T> {
  items: T[];
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
}

export function MessageList<T>({
  items,
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
}: MessageListProps<T>) {
  const virtuosoRef = React.useRef<VirtuosoHandle | null>(null);

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

  if (!items.length) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-4 text-sm">
        {emptyContent}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <Virtuoso
        ref={virtuosoRef}
        data={items}
        style={{ height: "100%", width: "100%" }}
        className="px-4 pt-6"
        alignToBottom
        followOutput={followOutput}
        atBottomStateChange={onAtBottomChange}
        increaseViewportBy={400}
        computeItemKey={computeItemKey}
        itemContent={(index, item) => itemContent(index, item)}
        components={
          {
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
