import React from "react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "../PageChrome";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

const TopBar: React.FC<TopBarProps> = ({ title, subtitle, onBack, actions }) => {
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
      showLogo
      onBack={onBack ? handleBack : undefined}
      actions={actions}
      dense={false}
    />
  );
};

export default TopBar;
