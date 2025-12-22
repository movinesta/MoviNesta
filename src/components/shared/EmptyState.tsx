import React from "react";
import { Button } from "../ui/Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-background/90 p-6 text-center shadow-lg">
      {icon ? (
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {subtitle ? <p className="max-w-md text-[12px] text-muted-foreground">{subtitle}</p> : null}
      {actionLabel ? (
        <Button size="sm" onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};

export default EmptyState;
