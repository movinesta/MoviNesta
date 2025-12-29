import React from "react";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
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
  labelClassName = "text-xs font-medium text-muted-foreground",
  className = "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-sm",
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
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

export default TextField;
