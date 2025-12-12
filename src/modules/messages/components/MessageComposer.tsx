import React from "react";

import { cn } from "@/lib/utils";

interface MessageComposerProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({ children, className, ...formProps }) => {
  return (
    <form
      {...formProps}
      className={cn(
        "border-t border-border bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75",
        className,
      )}
    >
      {children}
    </form>
  );
};
