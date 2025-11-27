import React from "react";
import { Button } from "../ui/Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, actionLabel, onAction }) => {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-mn-border-subtle/80 bg-mn-bg/90 p-6 text-center shadow-mn-card">
      {icon ? (
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mn-primary/10 text-mn-primary">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-mn-text-primary">{title}</h3>
      {subtitle ? <p className="max-w-md text-[12px] text-mn-text-muted">{subtitle}</p> : null}
      {actionLabel ? (
        <Button size="sm" onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};

export default EmptyState;
