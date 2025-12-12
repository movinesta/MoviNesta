import React from "react";

interface MessageComposerProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({ children, ...formProps }) => {
  return (
    <form
      {...formProps}
      className={`border-t border-border bg-background/90 px-4 py-3 backdrop-blur ${formProps.className ?? ""}`}
    >
      {children}
    </form>
  );
};
