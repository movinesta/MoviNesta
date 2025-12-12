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
      <div className="w-full bg-gradient-to-t from-background via-background/90 to-transparent px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <form
          {...formProps}
          className={cn(
            "pointer-events-auto flex w-full flex-col gap-2 rounded-3xl border border-border/60 bg-card/85 p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/65",
            "ring-1 ring-black/5",
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
