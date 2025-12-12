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
  const containerRef = React.useRef<HTMLFormElement | null>(null);

  React.useEffect(() => {
    if (!onHeightChange || !containerRef.current) return;

    const element = containerRef.current;
    const updateSize = () => onHeightChange(element.getBoundingClientRect().height);

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [onHeightChange]);

  return (
    <form
      ref={containerRef}
      {...formProps}
      className={cn(
        "sticky bottom-0 z-20 flex-shrink-0 space-y-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur",
        className,
      )}
      style={{ minHeight, ...style }}
    >
      {children}
    </form>
  );
};
