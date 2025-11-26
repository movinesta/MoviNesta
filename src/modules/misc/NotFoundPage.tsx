import React from "react";
import { useNavigate } from "react-router-dom";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-mn-bg px-4">
      <div className="max-w-md rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/90 p-6 text-center shadow-mn-card backdrop-blur">
        <h1 className="text-lg font-heading font-semibold text-mn-text-primary">Page not found</h1>
        <p className="mt-2 text-sm text-mn-text-secondary">
          We couldn&apos;t find that screen. Maybe it got lost in the credits.
        </p>
        <button
          type="button"
          onClick={() => navigate("/", { replace: true })}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-mn-primary px-4 py-2 text-xs font-semibold text-black shadow-mn-soft transition hover:bg-mn-accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
        >
          Back to Home
        </button>
        <p className="mt-3 text-xs text-mn-text-secondary">
          If you keep seeing this screen, try{" "}
          <button
            type="button"
            onClick={() => navigate("/auth/sign-in")}
            className="underline underline-offset-2"
          >
            signing in again
          </button>
          .
        </p>
      </div>
    </div>
  );
};

export default NotFoundPage;
