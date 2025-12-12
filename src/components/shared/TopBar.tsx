import React from "react";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

const TopBar: React.FC<TopBarProps> = () => {
  return null;
};

export default TopBar;
