import React from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import movinestaLogoNeon from "../../assets/brand/movinesta-logo-neon.png";
import { useAuth } from "../../modules/auth/AuthProvider";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  dense?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  showLogo = false,
  onBack,
  actions,
  dense = false,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(-1);
  };

  return (
    <header
      className={`sticky top-0 z-20 flex items-center justify-between gap-3 rounded-2xl border border-mn-border-subtle/80 bg-gradient-to-r from-mn-bg/90 via-mn-bg/95 to-mn-bg/90 px-4 shadow-mn-card backdrop-blur ${
        dense ? "h-12" : "h-14"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mn-border-subtle bg-mn-bg-elevated/80 text-mn-text-primary shadow-mn-soft transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <div className="flex min-w-0 items-center gap-2 truncate">
          {showLogo ? (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-mn-bg-elevated/80 p-1 shadow-mn-soft">
              <img
                src={movinestaLogoNeon}
                alt="MoviNesta"
                className="h-5 w-5 rounded-full object-contain"
              />
            </span>
          ) : null}

          <div className="min-w-0 leading-tight">
            {title ? (
              <p className="truncate text-lg font-semibold text-mn-text-primary">{title}</p>
            ) : null}
            {subtitle ? (
              <p className="truncate text-[11px] text-mn-text-muted">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {actions}
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
      </div>
    </header>
  );
};

export const InlineIconButton: React.FC<{
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  onClick?: () => void;
}> = ({ icon: Icon = MoreHorizontal, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mn-border-subtle bg-mn-bg-elevated/80 text-mn-text-primary shadow-mn-soft transition hover:-translate-y-0.5 hover:border-mn-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
    aria-label={label ?? "Action"}
  >
    <Icon className="h-4 w-4" aria-hidden="true" />
  </button>
);

export default TopBar;
