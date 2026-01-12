import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, Flame, MessageCircle, Search } from "lucide-react";
import { useUIStore } from "../lib/ui-store";
import { useI18n } from "@/i18n/useI18n";
import { useCurrentProfile } from "@/modules/profile/useProfile";
import { AssistantHintChip } from "@/modules/assistant/AssistantHintChip";
import { useEnsureAssistantConversation } from "@/modules/assistant/useEnsureAssistantConversation";
import { getAssistantSurfaceContext } from "@/modules/assistant/assistantSurface";

const AppShell: React.FC = () => {
  const location = useLocation();
  const { setLastVisitedTab } = useUIStore();
  const { t } = useI18n();
  useEnsureAssistantConversation();
  const { data: currentProfile } = useCurrentProfile();

  const getInitials = React.useCallback((displayName?: string | null, username?: string | null) => {
    const source = displayName || username || "";
    const cleaned = source.replace(/^@/, "").trim();
    if (!cleaned) return "?";
    const parts = cleaned.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, []);

  const bottomTabs = React.useMemo(
    () => [
      { key: "home" as const, to: "/home", label: t("nav.home"), icon: Home },
      { key: "swipe" as const, to: "/swipe", label: t("nav.swipe"), icon: Flame },
      { key: "messages" as const, to: "/messages", label: t("nav.messages"), icon: MessageCircle },
      { key: "search" as const, to: "/search", label: t("nav.search"), icon: Search },
      { key: "profile" as const, to: "/me", label: t("nav.profile"), icon: null },
    ],
    [t],
  );

  React.useEffect(() => {
    if (location.pathname === "/search") {
      setLastVisitedTab("search");
    }
  }, [location.pathname, setLastVisitedTab]);

  const isConversationRoute =
    location.pathname.startsWith("/messages/") && location.pathname !== "/messages";

  // Full-screen assistant chat experience (no bottom nav), similar to conversation pages.
  const isAssistantRoute =
    location.pathname === "/assistant" || location.pathname.startsWith("/assistant/");

  const isSwipeRoute = location.pathname === "/swipe" || location.pathname.startsWith("/swipe/");

  const assistant = React.useMemo(() => getAssistantSurfaceContext(location), [location]);

  const shellContentClassName =
    isConversationRoute || isAssistantRoute
      ? "relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-1 flex-col px-0 pt-0 pb-0"
      : isSwipeRoute
        ? // Swipe route: no extra bottom padding; let SwipePage handle internal spacing.
          "relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-0 pt-0 pb-0"
        : // Default layout (other tabs): keep padding so content clears bottom nav.
          "relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4";

  const bottomNavInnerClassName =
    isConversationRoute || isAssistantRoute
      ? "flex items-center justify-between gap-1 px-3 py-1.5"
      : "mx-auto flex max-w-5xl items-center justify-between gap-1 px-4 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]";

  const handleTabClick = (key: (typeof bottomTabs)[number]["key"]) => {
    setLastVisitedTab(key);
  };

  const profileTabActive = React.useMemo(() => {
    const username = currentProfile?.username;
    if (location.pathname === "/me") return true;
    if (username && location.pathname === `/u/${username}`) return true;
    if (username && location.pathname.startsWith(`/u/${username}/`)) return true;
    return false;
  }, [currentProfile?.username, location.pathname]);

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div className={shellContentClassName}>
        {/* Swipe route: prevent scroll in this area */}
        <main className={isSwipeRoute ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0"}>
          <Outlet />
        </main>
      </div>

      {/* Assistant (Option B): floating hint chip. On conversation pages, lift it above the composer. */}
      {!isAssistantRoute && (
        <AssistantHintChip
          surface={assistant.surface}
          context={assistant.context}
          className={isConversationRoute ? "bottom-[7.75rem]" : undefined}
        />
      )}

      {!isConversationRoute && !isAssistantRoute && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background"
          aria-label="Main"
        >
          <div className={bottomNavInnerClassName}>
            {bottomTabs.map((tab) => {
              const Icon = tab.icon as any;
              const isProfileTab = tab.key === "profile";
              const manualActive = isProfileTab ? profileTabActive : undefined;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  onClick={() => handleTabClick(tab.key)}
                  className={({ isActive }) => {
                    const active = manualActive ?? isActive;
                    return [
                      "group flex min-h-11 flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active ? "text-primary" : "text-muted-foreground hover:text-muted-foreground",
                    ].join(" ");
                  }}
                  aria-label={tab.label}
                  aria-current={(manualActive ?? undefined) ? "page" : undefined}
                >
                  {({ isActive }) => {
                    const active = manualActive ?? isActive;
                    return (
                      <>
                        <span
                          className={[
                            "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent bg-transparent transition",
                            active ? "border-primary/40 bg-background" : "",
                          ].join(" ")}
                        >
                          {isProfileTab ? (
                            currentProfile?.avatarUrl ? (
                              <img
                                src={currentProfile.avatarUrl}
                                alt={
                                  currentProfile.displayName || currentProfile.username || "Profile"
                                }
                                className="h-5 w-5 rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
                                {getInitials(currentProfile?.displayName, currentProfile?.username)}
                              </span>
                            )
                          ) : (
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          )}
                        </span>
                        <span className="mt-0.5">{tab.label}</span>
                      </>
                    );
                  }}
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
