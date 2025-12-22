import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Flame, MessageCircle, Search, BookOpen } from "lucide-react";
import { useUIStore } from "../lib/ui-store";
import { useI18n } from "@/i18n/useI18n";

const AppShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setLastVisitedTab, startTab } = useUIStore();
  const hasAppliedStartTab = React.useRef(false);
  const { t } = useI18n();

  const bottomTabs = React.useMemo(
    () => [
      { key: "home" as const, to: "/", label: t("nav.home"), icon: Home },
      { key: "swipe" as const, to: "/swipe", label: t("nav.swipe"), icon: Flame },
      { key: "messages" as const, to: "/messages", label: t("nav.messages"), icon: MessageCircle },
      { key: "search" as const, to: "/search", label: t("nav.search"), icon: Search },
      { key: "diary" as const, to: "/diary", label: t("nav.diary"), icon: BookOpen },
    ],
    [t],
  );

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

  const isSwipeRoute = location.pathname === "/swipe";

  const shellContentClassName = isConversationRoute
    ? "relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-1 flex-col px-0 pt-0 pb-0 sm:px-0 sm:pb-0"
    : isSwipeRoute
      ? // Swipe route: no extra bottom padding; let SwipePage handle internal spacing.
        "relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-0 pt-4 pb-0 sm:px-0 sm:pt-4 sm:pb-0"
      : // Default layout (other tabs): keep padding so content clears bottom nav.
        "relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-[calc(6rem+env(safe-area-inset-bottom))]";

  const bottomNavInnerClassName = isConversationRoute
    ? "flex items-center justify-between gap-1 px-3 py-1.5 sm:px-4"
    : "mx-auto flex max-w-5xl items-center justify-between gap-1 px-4 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:px-5";

  const handleTabClick = (key: (typeof bottomTabs)[number]["key"]) => {
    setLastVisitedTab(key);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div className={shellContentClassName}>
        {/* Swipe route: prevent scroll in this area */}
        <main className={isSwipeRoute ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0"}>
          <Outlet />
        </main>
      </div>

      {!isConversationRoute && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background"
          aria-label="Main"
        >
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
                      "group flex flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-muted-foreground",
                    ].join(" ")
                  }
                  aria-label={tab.label}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent bg-transparent transition group-[&.active]:border-primary group-[&.active]:bg-background">
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
