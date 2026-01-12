import React from "react";
import { Button } from "./Button";
import { cn } from "../lib/ui";

type Props = { children: React.ReactNode; className?: string };
type State = { error?: unknown };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    // Keep a console breadcrumb for debugging
    // eslint-disable-next-line no-console
    console.error("[admin] Uncaught UI error", error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message =
      this.state.error && typeof this.state.error === "object" && "message" in (this.state.error as any)
        ? String((this.state.error as any).message)
        : String(this.state.error);

    return (
      <div className={cn("mx-auto w-full max-w-2xl p-6", this.props.className)}>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-950">
          <div className="text-sm font-semibold">Something went wrong in the dashboard UI</div>
          <div className="mt-2 whitespace-pre-wrap text-sm">{message}</div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button
              variant="ghost"
              onClick={() => {
                try {
                  void navigator.clipboard.writeText(message);
                } catch {
                  // ignore
                }
              }}
            >
              Copy error
            </Button>
          </div>

          <div className="mt-3 text-[11px] text-rose-900/70">
            Tip: if this repeats, open DevTools Console and check for the first error stack trace.
          </div>
        </div>
      </div>
    );
  }
}
