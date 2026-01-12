import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./modules/auth/AuthProvider";
import { PresenceProvider } from "./modules/presence/PresenceProvider";
import { queryClient } from "./lib/react-query";
import { PublicSettingsProvider } from "./providers/PublicSettingsProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <PublicSettingsProvider>
        <PresenceProvider>
          <QueryClientProvider client={queryClient}>
            {(() => {
              // GitHub Pages can't serve SPA deep links like /messages/:id (it 404s on refresh).
              // Use HashRouter automatically on github.io in production.
              const basename = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "/";
              const isGithubPages =
                import.meta.env.PROD &&
                typeof window !== "undefined" &&
                window.location.hostname.endsWith("github.io");

              // On GitHub Pages we use HashRouter, and we MUST NOT use a basename like "/MoviNesta".
              // HashRouter uses the hash portion for routing (e.g. /#/messages/123), so a basename would
              // require /#/MoviNesta/messages/123 which we don't want.
              const Router = isGithubPages ? HashRouter : BrowserRouter;
              const routerBasename = isGithubPages ? "/" : basename;

              return (
                <Router basename={routerBasename}>
                  <App />
                </Router>
              );
            })()}
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
          </QueryClientProvider>
        </PresenceProvider>
      </PublicSettingsProvider>
    </AuthProvider>
  </React.StrictMode>,
);
