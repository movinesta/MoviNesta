import React from "react";

import { cn } from "@/lib/utils";
import { getBubbleAppearance } from "../messageModel";

interface MessageBubbleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isSelf: boolean;
  isDeleted: boolean;
  children: React.ReactNode;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  isSelf,
  isDeleted,
  children,
  className = "",
  ...bubbleProps
}) => {
  const { bubbleColors, bubbleShape } = getBubbleAppearance({ isSelf, isDeleted });

  return (
    <button
      type="button"
      className={cn(
        "inline-flex max-w-[80%] px-4 py-2.5 text-sm transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        bubbleShape,
        bubbleColors,
        className,
      )}
      {...bubbleProps}
    >
      <div className="flex flex-col gap-1 text-left leading-relaxed">{children}</div>
    </button>
  );
};
