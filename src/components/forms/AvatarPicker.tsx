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
      {label && <p className="text-[11px] font-medium text-mn-text-secondary">{label}</p>}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleAvatarClick}
          disabled={disabled}
          className="relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-dashed border-mn-border bg-mn-bg-elevated/80 text-xs font-medium text-mn-text-secondary hover:border-mn-primary hover:bg-mn-primary/5 focus:outline-none focus:ring-2 focus:ring-mn-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Upload avatar"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Avatar preview" className="h-full w-full object-cover" />
          ) : (
            <span className="select-none text-lg">{fallbackIcon ?? "📽️"}</span>
          )}
        </button>

        {description && (
          <div className="text-[11px] text-left text-mn-text-muted">{description}</div>
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
