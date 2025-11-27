import React from "react";
import { useNavigate } from "react-router-dom";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-mn-bg px-4 text-mn-text-primary">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(94,234,212,0.14),transparent_55%),radial-gradient(circle_at_82%_25%,rgba(94,234,212,0.12),transparent_45%),radial-gradient(circle_at_50%_85%,rgba(244,114,182,0.14),transparent_50%)]"
      />
      <div className="relative max-w-lg rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/90 p-8 text-center shadow-mn-soft backdrop-blur">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mn-text-muted">
            Not found
          </p>
          <h1 className="text-xl font-heading font-semibold text-mn-text-primary">
            This scene is missing
          </h1>
          <p className="text-sm text-mn-text-secondary">
            We couldn&apos;t find that page. It might have been moved, or the URL is a little
            off-script.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="inline-flex items-center justify-center rounded-full bg-mn-primary px-5 py-2 text-sm font-semibold text-black shadow-mn-soft transition hover:bg-mn-accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          >
            Back to Home
          </button>
          <button
            type="button"
            onClick={() => navigate("/auth/signin")}
            className="inline-flex items-center justify-center rounded-full border border-mn-border-subtle/80 bg-mn-bg px-5 py-2 text-sm font-semibold text-mn-text-primary shadow-mn-soft transition hover:border-mn-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          >
            Go to sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
