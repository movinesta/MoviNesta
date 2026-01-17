import React, { useEffect, useRef, useState } from "react";

interface AvatarPickerProps {
  label?: string;
  description?: React.ReactNode;
  initialUrl?: string | null;
  disabled?: boolean;
  onFileChange?: (file: File | null) => void;
  fallbackIcon?: React.ReactNode;
  className?: string;
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({
  label = "Avatar",
  description,
  initialUrl = null,
  disabled = false,
  onFileChange,
  fallbackIcon,
  className,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setPreviewUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleAvatarClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      onFileChange?.(null);
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    onFileChange?.(file);
  };

  const wrapperClass = "pt-1" + (className ? ` ${className}` : "");

  return (
    <div className={wrapperClass}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleAvatarClick}
          disabled={disabled}
          className="relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-dashed border-border bg-card/80 text-xs font-medium text-muted-foreground hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Upload avatar"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Avatar preview" className="h-full w-full object-cover" />
          ) : (
            <span className="select-none text-lg">{fallbackIcon ?? "📽️"}</span>
          )}
        </button>

        {description && (
          <div className="text-xs text-left text-muted-foreground">{description}</div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default AvatarPicker;
