import React from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import AppRoutes from "./router";
import { ToastProvider } from "./components/toasts";

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppRoutes />
      <ToastProvider />
    </ErrorBoundary>
  );
};

export default App;
