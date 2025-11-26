import React from "react";

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
    // eslint-disable-next-line no-console
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-mn-bg px-4 py-8 text-center text-mn-text-primary">
          <div className="w-full max-w-md space-y-3 rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 p-6 shadow-mn-card">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-mn-primary/15 text-mn-primary">
              <span aria-hidden="true">🎬</span>
            </div>
            <h1 className="text-lg font-heading font-semibold">Something went wrong</h1>
            <p className="text-sm text-mn-text-secondary">
              The last action caused the app to stumble. You can try again or reload MoviNesta.
            </p>
            {this.state.error && (
              <pre className="overflow-auto rounded-xl bg-mn-bg/70 p-3 text-left text-[11px] text-mn-text-muted">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-full bg-mn-primary px-4 py-2 text-sm font-semibold text-mn-bg transition hover:bg-mn-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-full border border-mn-border-subtle/80 px-4 py-2 text-sm font-medium text-mn-text-secondary transition hover:border-mn-border-strong/80 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
