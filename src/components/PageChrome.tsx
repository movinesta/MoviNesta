import React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

import { MOVINESTA_LOGO_URL } from "../constants/brand";
import { useAuth } from "../modules/auth/AuthProvider";

const HEADER_BASE_CLASSNAME =
  "sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-[var(--page-pad-x)] py-1.5 shadow-sm backdrop-blur";

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
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="icon-hit border-border bg-background/95 shadow-sm"
      aria-label="Account"
    >
      {user?.user_metadata?.avatar_url ? (
        <img
          src={user.user_metadata.avatar_url}
          alt={user.email ?? "User"}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background text-[12px] font-semibold text-muted-foreground">
          {user?.email?.[0]?.toUpperCase() ?? "M"}
        </span>
      )}
    </Button>
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
    <HeaderSurface className={dense ? "h-11" : "h-12"}>
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <Button
            type="button"
            onClick={onBack}
            variant="outline"
            size="icon"
            className="icon-hit border-border bg-card/80 text-foreground shadow-sm"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        <div className="flex min-w-0 items-center gap-2 truncate">
          {showLogo && (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-card/80 p-1.5 shadow-sm">
              <img
                src={MOVINESTA_LOGO_URL}
                alt="MoviNesta"
                className="h-5 w-5 rounded-full object-contain"
              />
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate type-heading text-foreground">{title}</p>
            {description && (
              <p className="truncate type-caption text-muted-foreground">{description}</p>
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
      ? "rounded-2xl border border-dashed border-border/60 bg-muted/60"
      : "rounded-2xl border border-border/60 bg-card/80 shadow-sm";

  return (
    <section className={[surfaceClassName, padded ? "p-[var(--card-pad)]" : "p-0"].join(" ")}>
      {(title || description || actions) && (
        <div className="mb-2 flex flex-col gap-1.5">
          <div className="space-y-1">
            {title && <h2 className="type-label text-foreground">{title}</h2>}
            {description && <p className="type-caption text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {children}
    </section>
  );
};
