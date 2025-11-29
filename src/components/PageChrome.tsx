import React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";

import { MOVINESTA_LOGO_URL } from "../constants/brand";
import { useAuth } from "../modules/auth/AuthProvider";

const HEADER_BASE_CLASSNAME =
  "sticky top-0 z-20 flex items-center justify-between gap-3 rounded-2xl border border-mn-border-subtle/80 bg-gradient-to-r from-mn-bg/90 via-mn-bg/95 to-mn-bg/90 px-3 py-2 shadow-mn-card backdrop-blur sm:px-4";

export const HeaderSurface: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <header className={[HEADER_BASE_CLASSNAME, className].filter(Boolean).join(" ")}>
    {children}
  </header>
);

const AccountButton: React.FC = () => {
  const { user } = useAuth();

  return (
    <button
      type="button"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mn-border-subtle bg-mn-bg-elevated/70 text-mn-text-primary shadow-mn-soft transition hover:border-mn-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
      aria-label="Account"
    >
      {user?.user_metadata?.avatar_url ? (
        <img
          src={user.user_metadata.avatar_url}
          alt={user.email ?? "User"}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-bg text-[12px] font-semibold text-mn-text-secondary">
          {user?.email?.[0]?.toUpperCase() ?? "M"}
        </span>
      )}
    </button>
  );
};

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon; // now unused, but kept to avoid breaking API
  kicker?: string; // unused
  badge?: string; // unused
  actions?: React.ReactNode;
  alignment?: "left" | "center"; // unused
  showLogo?: boolean;
  onBack?: () => void;
  dense?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  showLogo = true,
  onBack,
  dense = false,
}) => {
  return (
    <HeaderSurface className={dense ? "h-12" : "h-14"}>
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mn-border-subtle bg-mn-bg-elevated/80 text-mn-text-primary shadow-mn-soft transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <div className="flex min-w-0 items-center gap-2 truncate">
          {showLogo && (
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-mn-bg-elevated/80 p-1.5 shadow-mn-soft">
              <img
                src={MOVINESTA_LOGO_URL}
                alt="MoviNesta"
                className="h-6 w-6 rounded-full object-contain"
              />
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-lg font-semibold text-mn-text-primary">{title}</p>
            {description && (
              <p className="truncate text-[11px] text-mn-text-muted">{description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {actions && <div className="flex items-center gap-2">{actions}</div>}
        <AccountButton />
      </div>
    </HeaderSurface>
  );
};

interface PageSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "default" | "muted";
  padded?: boolean;
}

export const PageSection: React.FC<PageSectionProps> = ({
  title,
  description,
  children,
  actions,
  tone = "default",
  padded = true,
}) => {
  const surfaceClassName =
    tone === "muted"
      ? "rounded-2xl border border-dashed border-mn-border-subtle/70 bg-mn-bg-elevated/50"
      : "rounded-2xl border border-mn-border-subtle/70 bg-mn-bg-elevated/70 shadow-mn-soft";

  return (
    <section className={[surfaceClassName, padded ? "p-4" : "p-0"].join(" ")}>
      {(title || description || actions) && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title && (
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">{title}</h2>
            )}
            {description && <p className="text-[11px] text-mn-text-secondary">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {children}
    </section>
  );
};
