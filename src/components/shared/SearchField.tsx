import React from "react";
import { Search } from "lucide-react";

interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const SearchField: React.FC<SearchFieldProps> = ({ className = "", ...props }) => {
  return (
    <div
      className={
        `flex h-11 flex-1 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 text-sm shadow-sm ` +
        `transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${className}`
      }
    >
      <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <input
        {...props}
        className="h-full flex-1 border-none bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none"
      />
    </div>
  );
};

export default SearchField;
