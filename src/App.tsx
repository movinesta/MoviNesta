import React from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import AppRoutes from "./router";

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  );
};

export default App;
