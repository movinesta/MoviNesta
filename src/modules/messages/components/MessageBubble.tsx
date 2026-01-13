import React from "react";

import { cn } from "@/lib/utils";
import { getBubbleAppearance } from "../messageModel";

interface MessageBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  isSelf: boolean;
  isDeleted: boolean;
  startsGroup?: boolean;
  endsGroup?: boolean;
  children: React.ReactNode;
}

export const MessageBubble = React.memo(function MessageBubble({
  isSelf,
  isDeleted,
  startsGroup,
  endsGroup,
  children,
  className = "",
  role,
  tabIndex,
  ...bubbleProps
}: MessageBubbleProps) {
  const { bubbleColors, bubbleShape } = getBubbleAppearance({ isSelf, isDeleted, startsGroup, endsGroup });

  return (
    <div
      role={role ?? "button"}
      tabIndex={tabIndex ?? 0}
      className={cn(
        "inline-flex max-w-[82%] px-4 py-2.5 text-[14px] leading-snug md:text-[15px] md:leading-relaxed transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]",
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
