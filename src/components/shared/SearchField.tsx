import React from "react";
import { Search } from "lucide-react";

interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const SearchField: React.FC<SearchFieldProps> = ({ className = "", ...props }) => {
  return (
    <div
      className={`flex flex-1 items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm shadow-md focus-within:border-primary/70 ${className}`}
    >
      <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <input
        {...props}
        className="flex w-full rounded-md border border-input transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 h-8 flex-1 border-none bg-transparent p-0 text-sm text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:ring-0"
      />
    </div>
  );
};

export default SearchField;
