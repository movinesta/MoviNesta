import React from "react";
import { refreshTmdbConfigurationCache } from "./lib/tmdb";
import ErrorBoundary from "./components/ErrorBoundary";
import AppRoutes from "./router";
import { ToastProvider } from "./components/toasts";

const App: React.FC = () => {
  React.useEffect(() => {
    // Best-effort refresh of TMDB image configuration cache.
    // This keeps image URLs correct (base_url + size + file_path).
    void refreshTmdbConfigurationCache();
  }, []);

  return (
    <ErrorBoundary>
      <AppRoutes />
      <ToastProvider />
    </ErrorBoundary>
  );
};

export default App;
