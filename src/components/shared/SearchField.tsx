import React from "react";
import { Search, SlidersHorizontal } from "lucide-react";

interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onFilterClick?: () => void;
}

const SearchField: React.FC<SearchFieldProps> = ({ onFilterClick, className = "", ...props }) => {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg px-3 py-2 text-[13px] shadow-mn-soft ${className}`}
    >
      <Search className="h-4 w-4 text-mn-text-muted" aria-hidden="true" />
      <input
        {...props}
        className="flex-1 bg-transparent text-[13px] text-mn-text-primary placeholder:text-mn-text-muted focus:outline-none"
      />
      {onFilterClick ? (
        <button
          type="button"
          onClick={onFilterClick}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-mn-text-secondary hover:bg-mn-bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};

export default SearchField;
