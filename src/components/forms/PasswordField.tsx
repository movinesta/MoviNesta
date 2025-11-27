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
  labelClassName = "text-xs font-medium text-mn-text-secondary",
  className = "w-full rounded-lg border border-mn-border bg-mn-bg-elevated/90 px-3 py-2 pr-10 text-sm text-mn-text-primary shadow-sm placeholder:text-mn-text-muted focus:border-mn-primary focus:outline-none focus:ring-2 focus:ring-mn-primary/40",
  toggleButtonClassName = "absolute inset-y-0 right-0 flex items-center pr-3 text-[13px] text-mn-text-muted hover:text-mn-text-secondary",
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
