import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Flame, MessageCircle, Search, BookOpen } from "lucide-react";
import { applyThemePreference, syncSystemThemePreference, useUIStore } from "../lib/ui-store";

const bottomTabs = [
  { key: "home" as const, to: "/", label: "Home", icon: Home },
  { key: "swipe" as const, to: "/swipe", label: "Swipe", icon: Flame },
  { key: "messages" as const, to: "/messages", label: "Messages", icon: MessageCircle },
  { key: "search" as const, to: "/search", label: "Search", icon: Search },
  { key: "diary" as const, to: "/diary", label: "Diary", icon: BookOpen },
];

const AppShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setLastVisitedTab, startTab, theme } = useUIStore();
  const hasAppliedStartTab = React.useRef(false);

  React.useEffect(() => {
    applyThemePreference(theme);
    const cleanup = syncSystemThemePreference();
    return cleanup;
  }, [theme]);

  React.useEffect(() => {
    if (hasAppliedStartTab.current) return;
    if (location.pathname === "/" && startTab !== "home") {
      const target = startTab === "swipe" ? "/swipe" : "/diary";
      navigate(target, { replace: true });
      setLastVisitedTab(startTab);
      hasAppliedStartTab.current = true;
    }
    hasAppliedStartTab.current = true;
  }, [location.pathname, navigate, setLastVisitedTab, startTab]);

  const isConversationRoute =
    location.pathname.startsWith("/messages/") && location.pathname !== "/messages";

  const shellContentClassName = isConversationRoute
    ? "relative z-10 mx-auto flex h-screen w-full max-w-5xl flex-1 flex-col px-0 pt-0 pb-0 sm:px-0 sm:pb-0"
    : "relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-20 pt-4 sm:px-5 sm:pb-24";

  const bottomNavInnerClassName = isConversationRoute
    ? "flex items-center justify-between gap-1 px-3 py-1.5 sm:px-4"
    : "mx-auto flex max-w-5xl items-center justify-between gap-1 px-4 py-1.5 sm:px-5";

  const handleTabClick = (key: (typeof bottomTabs)[number]["key"]) => {
    setLastVisitedTab(key);
  };

  return (
    <div className="flex min-h-screen flex-col bg-mn-bg text-mn-text-primary">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,253,0.18),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(248,113,113,0.12),_transparent_55%)]"
      />

      <div className={shellContentClassName}>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {!isConversationRoute && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-mn-border-subtle/80 bg-mn-bg/95 backdrop-blur">
          <div className={bottomNavInnerClassName}>
            {bottomTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  onClick={() => handleTabClick(tab.key)}
                  className={({ isActive }) =>
                    [
                      "group flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-medium transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg",
                      isActive
                        ? "text-mn-primary"
                        : "text-mn-text-muted hover:text-mn-text-secondary",
                    ].join(" ")
                  }
                  aria-label={tab.label}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-mn-bg-elevated/80 shadow-mn-soft transition group-[&.active]:border-mn-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="mt-0.5">{tab.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default AppShell;
