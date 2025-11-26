import React from "react";

interface TextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  containerClassName?: string;
  labelClassName?: string;
  hint?: string;
  error?: string;
}

/**
 * Reusable text input with label, optional hint, and error message.
 * Styled to match MoviNesta forms and accessible out of the box.
 */
const TextField: React.FC<TextFieldProps> = ({
  id,
  label,
  containerClassName = "space-y-1.5",
  labelClassName = "text-xs font-medium text-mn-text-secondary",
  className = "w-full rounded-lg border border-mn-border bg-mn-bg-input px-3 py-2 text-sm text-mn-text-primary placeholder:text-mn-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg",
  hint,
  error,
  ...inputProps
}) => {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={containerClassName}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <input
        id={id}
        className={className}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-mn-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-mn-error">
          {error}
        </p>
      )}
    </div>
  );
};

export default TextField;
