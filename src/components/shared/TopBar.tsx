import React from "react";
import { MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "../PageChrome";

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
  showLogo = true,
  onBack,
  actions,
  dense = false,
}) => {
  const navigate = useNavigate();

  const handleBack = React.useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(-1);
  }, [navigate, onBack]);

  return (
    <PageHeader
      title={title ?? ""}
      description={subtitle}
      showLogo={showLogo}
      onBack={onBack ? handleBack : undefined}
      actions={actions}
      dense={dense}
    />
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
