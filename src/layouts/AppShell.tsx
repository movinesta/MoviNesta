import React from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { Home, Flame, MessageCircle, Search, BookOpen, ChevronDown } from "lucide-react";
import movinestaLogoNeon from "../assets/brand/movinesta-logo-neon.png";
import { useUIStore } from "../lib/ui-store";
import { useAuth } from "../modules/auth/AuthProvider";

const bottomTabs = [
  { key: "home" as const, to: "/", label: "Home", icon: Home },
  { key: "swipe" as const, to: "/swipe", label: "Swipe", icon: Flame },
  { key: "messages" as const, to: "/messages", label: "Messages", icon: MessageCircle },
  { key: "search" as const, to: "/search", label: "Search", icon: Search },
  { key: "diary" as const, to: "/diary", label: "Diary", icon: BookOpen },
];

function getTitleFromPath(pathname: string): string {
  if (pathname.startsWith("/swipe")) return "Swipe";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/search")) return "Search";
  if (pathname.startsWith("/diary")) return "Diary";
  if (pathname.startsWith("/title/")) return "Title";
  if (pathname.startsWith("/u/")) return "Profile";
  if (pathname.startsWith("/settings/")) return "Settings";
  return "Home";
}

const AppShell: React.FC = () => {
  const location = useLocation();
  const title = getTitleFromPath(location.pathname);
  const { setLastVisitedTab } = useUIStore();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const isConversationRoute =
    location.pathname.startsWith("/messages/") && location.pathname !== "/messages";

  const shellContentClassName = isConversationRoute
    ? "relative z-10 mx-auto flex h-screen w-full max-w-5xl flex-1 flex-col px-0 pt-0 pb-0 sm:px-0 sm:pb-0"
    : "relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 pb-20 pt-3 sm:px-4 sm:pb-24";

  const bottomNavInnerClassName = isConversationRoute
    ? "flex items-center justify-between gap-1 px-3 py-1.5 sm:px-4"
    : "mx-auto flex max-w-5xl items-center justify-between gap-1 px-3 py-1.5 sm:px-4";
  const handleTabClick = (key: (typeof bottomTabs)[number]["key"]) => {
    setLastVisitedTab(key);
    setMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-mn-bg text-mn-text-primary">
      {/* Gradient cinematic background overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,253,0.18),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(248,113,113,0.12),_transparent_55%)]"
      />

      {/* Shell content */}
      <div className={shellContentClassName}>
        {/* Top header */}
        {!isConversationRoute && (
          <header className="mb-3 flex items-center justify-between gap-3 rounded-full border border-mn-border-subtle/60 bg-mn-bg-elevated/70 px-3 py-2 shadow-mn-soft backdrop-blur">
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                <span className="h-7 w-7 rounded-2xl bg-mn-hero p-[2px]">
                  <span className="flex h-full w-full items-center justify-center rounded-2xl bg-mn-bg-elevated/80">
                    <img
                      src={movinestaLogoNeon}
                      alt="MoviNesta logo"
                      className="h-5 w-5 rounded-full object-contain"
                    />
                  </span>
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-heading font-semibold tracking-tight">
                    MoviNesta
                  </span>
                  <span className="text-[10px] text-mn-text-muted">
                    Your movie life, in one nest.
                  </span>
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-xs text-mn-text-secondary sm:block">
                <span className="font-medium text-mn-text-primary">{title}</span>
              </div>

              {/* Avatar menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-mn-border-subtle bg-mn-bg-elevated/80 px-2 py-1 text-xs shadow-mn-soft transition hover:border-mn-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-mn-accent-violet/30 text-[11px] font-semibold text-mn-text-primary">
                    {user?.email?.[0]?.toUpperCase() ?? "M"}
                  </span>
                  <span className="hidden text-[11px] font-medium text-mn-text-secondary sm:inline">
                    {user?.email ?? "Guest"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-mn-text-muted" aria-hidden="true" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-xl border border-mn-border-subtle bg-mn-bg-elevated/95 p-1 text-xs shadow-mn-card">
                    <Link
                      to="/settings/profile"
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-mn-text-secondary transition hover:bg-mn-border-subtle/40 hover:text-mn-text-primary"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span>Profile</span>
                    </Link>
                    <Link
                      to="/settings/app"
                      className="mt-0.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-mn-text-secondary transition hover:bg-mn-border-subtle/40 hover:text-mn-text-primary"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span>App settings</span>
                    </Link>
                    <button
                      type="button"
                      className="mt-0.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-mn-error transition hover:bg-mn-error/10"
                      onClick={async () => {
                        setMenuOpen(false);
                        await signOut();
                      }}
                    >
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Main route content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav */}
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
