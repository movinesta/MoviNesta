import React from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export interface TopBarAction {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface TopBarProps {
  title?: React.ReactNode;
  onBack?: () => void;
  canGoBack?: boolean;
  actions?: TopBarAction[] | React.ReactNode;
  below?: React.ReactNode;
}

const ROOT_ROUTES = new Set(["/home", "/swipe", "/messages", "/search", "/me"]);

const normalizePath = (pathname: string) =>
  pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

const TopBar = React.forwardRef<HTMLElement, TopBarProps>(
  ({ title, onBack, canGoBack = false, actions, below }, ref) => {
    const location = useLocation();
    const navigate = useNavigate();
    const normalizedPath = normalizePath(location.pathname);
    const showBack = canGoBack || !ROOT_ROUTES.has(normalizedPath);

    const handleBack = () => {
      if (onBack) {
        onBack();
        return;
      }
      navigate(-1);
    };

    return (
      <header
        ref={ref}
        className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          <div className="relative flex items-center justify-between gap-2 px-4 py-2">
            <div className="flex w-10 items-center justify-start">
              {showBack ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : (
                <span className="h-9 w-9" aria-hidden="true" />
              )}
            </div>

            <div className="absolute left-1/2 flex max-w-[70%] -translate-x-1/2 items-center justify-center text-center">
              {title ? (
                <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>
              ) : null}
            </div>

            <div className="flex min-w-[2.5rem] items-center justify-end gap-1">
              {Array.isArray(actions)
                ? actions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
                        aria-label={action.label}
                        disabled={action.disabled}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    );
                  })
                : actions}
            </div>
          </div>

          {below ? <div className="px-4 pb-2">{below}</div> : null}
        </div>
      </header>
    );
  },
);

TopBar.displayName = "TopBar";

export default TopBar;
