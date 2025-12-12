import React from "react";

import { cn } from "@/lib/utils";

interface MessageComposerProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({ children, className, ...formProps }) => {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background/95 to-transparent">
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <form
          {...formProps}
          className={cn(
            "pointer-events-auto rounded-2xl border border-border/80 bg-card/80 px-4 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] backdrop-blur supports-[backdrop-filter]:bg-card/70",
            className,
          )}
        >
          {children}
        </form>
      </div>
    </div>
  );
};
