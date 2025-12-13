import React from "react";

import { cn } from "@/lib/utils";
import { getBubbleAppearance } from "../messageModel";

interface MessageBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  isSelf: boolean;
  isDeleted: boolean;
  children: React.ReactNode;
}

export const MessageBubble = React.memo(function MessageBubble({
  isSelf,
  isDeleted,
  children,
  className = "",
  role,
  tabIndex,
  ...bubbleProps
}: MessageBubbleProps) {
  const { bubbleColors, bubbleShape } = getBubbleAppearance({ isSelf, isDeleted });

  return (
    <div
      role={role ?? "button"}
      tabIndex={tabIndex ?? 0}
      className={cn(
        "inline-flex max-w-[80%] px-4 py-2.5 text-sm transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        bubbleShape,
        bubbleColors,
        className,
      )}
      {...bubbleProps}
    >
      <div className="flex flex-col gap-1 text-left leading-relaxed">{children}</div>
    </div>
  );
});
