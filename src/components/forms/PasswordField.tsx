import React, { useState } from "react";

interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  label: string;
  containerClassName?: string;
  labelClassName?: string;
  toggleButtonClassName?: string;
  ariaLabelBase?: string;
}

const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  containerClassName = "space-y-1",
  labelClassName = "text-xs font-medium text-muted-foreground",
  className = "w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  toggleButtonClassName = "absolute inset-y-0 right-0 inline-flex h-11 w-11 items-center justify-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  ariaLabelBase,
  value,
  ...inputProps
}) => {
  const [visible, setVisible] = useState(false);

  const base = (ariaLabelBase || label || "password").toLowerCase();
  const ariaLabel = visible ? `Hide ${base}` : `Show ${base}`;

  const handleToggle = () => {
    setVisible((prev) => !prev);
  };

  return (
    <div className={containerClassName}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={className}
          value={value}
          {...inputProps}
        />

        <button
          type="button"
          onClick={handleToggle}
          className={toggleButtonClassName}
          aria-label={ariaLabel}
        >
          <span className="select-none">{visible ? "🙈" : "👁"}</span>
        </button>
      </div>
    </div>
  );
};

export default PasswordField;
