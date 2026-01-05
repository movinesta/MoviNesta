import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "Loading MoviNesta…" }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};
