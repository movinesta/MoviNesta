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
    <div ref={containerRef} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 w-full">
      <div className="w-full">
        <form
          {...formProps}
          className={cn(
            "pointer-events-auto flex w-full flex-col gap-2 border-t border-white/5 bg-background-dark/95 p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl",
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
