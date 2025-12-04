import React from "react";

interface MessageListProps {
  children: React.ReactNode;
}

export const MessageList: React.FC<MessageListProps> = ({ children }) => {
  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto px-4 py-4 text-sm">
      {children}
    </div>
  );
};
