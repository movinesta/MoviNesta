import React from "react";
import { AlertCircle, Search, Inbox, FileQuestion } from "lucide-react";
import { Button } from "./ui/button";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "search" | "error";
}

/**
 * Reusable empty state component
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = "default",
}) => {
  const iconColors = {
    default: "text-muted-foreground",
    search: "text-blue-500",
    error: "text-red-500",
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Icon className={`h-16 w-16 ${iconColors[variant]} mb-4`} aria-hidden />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-4">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="primary">
          {action.label}
        </Button>
      )}
    </div>
  );
};

/**
 * Error state component
 */
export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = "Something went wrong", message, onRetry }) => {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={message}
      action={onRetry ? { label: "Try Again", onClick: onRetry } : undefined}
      variant="error"
    />
  );
};

/**
 * No results state component
 */
export const NoResultsState: React.FC<{
  query?: string;
  onClear?: () => void;
}> = ({ query, onClear }) => {
  return (
    <EmptyState
      icon={Search}
      title="No Results Found"
      description={
        query ? `We couldn't find anything matching "${query}"` : "We couldn't find any results"
      }
      action={onClear ? { label: "Clear Filters", onClick: onClear } : undefined}
      variant="search"
    />
  );
};

/**
 * Not found (404) state component
 */
export const NotFoundState: React.FC<{
  resourceType?: string;
  onGoHome?: () => void;
}> = ({ resourceType = "page", onGoHome }) => {
  return (
    <EmptyState
      icon={FileQuestion}
      title={`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} Not Found`}
      description={`The ${resourceType} you're looking for doesn't exist or has been removed.`}
      action={onGoHome ? { label: "Go Home", onClick: onGoHome } : undefined}
      variant="default"
    />
  );
};
