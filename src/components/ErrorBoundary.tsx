import React from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("MoviNesta ErrorBoundary caught an error", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 text-center text-foreground">
          <div className="w-full max-w-md space-y-3 rounded-3xl border border-border bg-card/80 p-6 shadow-lg">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <span aria-hidden="true">🎬</span>
            </div>
            <h1 className="text-lg font-heading font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The last action caused the app to stumble. You can try again or reload MoviNesta.
            </p>
            {this.state.error && (
              <pre className="overflow-auto rounded-xl bg-background/70 p-3 text-left text-xs text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button type="button" onClick={this.handleRetry}>
                Try again
              </Button>
              <Button type="button" variant="outline" onClick={this.handleReload}>
                Reload app
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
