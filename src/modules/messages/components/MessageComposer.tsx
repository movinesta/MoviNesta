import React from "react";

import { cn } from "@/lib/utils";

interface MessageComposerProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  onHeightChange?: (height: number) => void;
  minHeight?: number;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  children,
  className,
  onHeightChange,
  minHeight,
  style,
  ...formProps
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [keyboardOffset, setKeyboardOffset] = React.useState(0);

  React.useEffect(() => {
    if (!onHeightChange || !containerRef.current) return;

    const element = containerRef.current;
    const updateSize = () => onHeightChange(element.getBoundingClientRect().height);

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [onHeightChange]);

  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) {
      setKeyboardOffset(0);
      return;
    }

    const updateOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(offset);
    };

    updateOffset();
    viewport.addEventListener("resize", updateOffset);
    viewport.addEventListener("scroll", updateOffset);
    window.addEventListener("orientationchange", updateOffset);

    return () => {
      viewport.removeEventListener("resize", updateOffset);
      viewport.removeEventListener("scroll", updateOffset);
      window.removeEventListener("orientationchange", updateOffset);
    };
  }, []);

  return (
    // NOTE: Don't use `pointer-events-none` on the wrapper. In HTML hit-testing,
    // a `pointer-events: none` ancestor can prevent descendants from receiving
    // pointer/keyboard focus events in many browsers.
    <div
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 z-40 w-full"
      style={{ transform: `translateY(-${keyboardOffset}px)` }}
    >
      <div className="w-full">
        <form
          {...formProps}
          className={cn(
            "flex w-full flex-col gap-2 border-t border-border bg-background/95 p-2.5 md:p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.15)] backdrop-blur-xl",
            className,
          )}
          style={{ minHeight, ...style }}
        >
          {children}
        </form>
      </div>
    </div>
  );
};
