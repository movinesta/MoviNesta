import { useCallback, useEffect, useRef, useState } from "react";

export function useConversationLayoutState({
  showComposer,
  initialHeaderHeight = 72,
  initialComposerHeight = 160,
}: {
  showComposer: boolean;
  initialHeaderHeight?: number;
  initialComposerHeight?: number;
}) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(initialHeaderHeight);
  const [composerHeight, setComposerHeight] = useState<number>(initialComposerHeight);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleComposerHeightChange = useCallback(
    (height: number) => setComposerHeight(Math.max(height, headerHeight)),
    [headerHeight],
  );

  useEffect(() => {
    const element = headerRef.current;
    if (!element) return;

    const updateSize = () => setHeaderHeight(Math.max(element.getBoundingClientRect().height, 0));

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setComposerHeight((prev) => Math.max(prev, headerHeight));
  }, [headerHeight]);

  useEffect(() => {
    if (!showComposer) {
      setComposerHeight(0);
    }
  }, [showComposer]);

  return {
    headerRef,
    headerHeight,
    composerHeight,
    isAtBottom,
    setIsAtBottom,
    handleComposerHeightChange,
    showEmojiPicker,
    setShowEmojiPicker,
  };
}
