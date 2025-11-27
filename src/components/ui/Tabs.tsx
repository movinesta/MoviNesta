import React, { createContext, useContext, useId, useState } from "react";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  idBase: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  defaultValue,
  onValueChange,
  className = "",
  children,
}) => {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const idBase = useId();

  const current = value ?? internal;

  const setValue = (next: string) => {
    if (value === undefined) {
      setInternal(next);
    }
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ value: current, setValue, idBase }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error("Tabs.* components must be used within <Tabs>");
  }
  return ctx;
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

export const TabsList: React.FC<TabsListProps> = ({ className = "", children }) => {
  const classes =
    "flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-mn-border-subtle/60 bg-mn-bg-elevated/70 p-1.5 backdrop-blur " +
    className;

  return (
    <div role="tablist" className={classes}>
      {children}
    </div>
  );
};

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  icon,
  className = "",
  children,
  ...props
}) => {
  const { value: active, setValue, idBase } = useTabs();
  const isActive = active === value;

  const base =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium outline-none transition";

  const variant = isActive
    ? "bg-mn-primary text-mn-bg shadow-mn-soft"
    : "bg-transparent text-mn-text-secondary hover:bg-mn-bg-elevated/70";

  const classes = [base, variant, className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`${idBase}-tabpanel-${value}`}
      className={classes}
      onClick={() => setValue(value)}
      {...props}
    >
      {icon && <span className="inline-flex h-3.5 w-3.5">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, className = "", children }) => {
  const { value: active, idBase } = useTabs();
  if (active !== value) return null;

  return (
    <div role="tabpanel" id={`${idBase}-tabpanel-${value}`} className={className}>
      {children}
    </div>
  );
};
