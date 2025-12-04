import React from "react";
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
      className={`inline-flex max-w-[80%] px-4 py-2.5 text-[13px] ${bubbleShape} ${bubbleColors} select-none transition-transform duration-150 ease-out ${className}`}
      {...bubbleProps}
    >
      <div className="flex flex-col">{children}</div>
    </button>
  );
};
