import React from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import AppRoutes from "./router";

const App: React.FC = () => {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:border focus:border-mn-border-subtle focus:bg-mn-bg-elevated/95 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-mn-text-primary focus:shadow-mn-card"
      >
        Skip to main content
      </a>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </>
  );
};

export default App;
