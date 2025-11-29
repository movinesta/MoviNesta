import React, { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Sparkles, Flame } from "lucide-react";
import { useAuth } from "./AuthProvider";

const AuthLoadingCard: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const directionRef = useRef<1 | -1>(1);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      directionRef.current = (directionRef.current === 1 ? -1 : 1) as 1 | -1;
      const nextOffset = directionRef.current * 14; // px
      setOffset(nextOffset);
    }, 850);

    return () => window.clearInterval(interval);
  }, []);

  const rotation = offset / 5;

  return (
    <div className="relative flex w-full max-w-md items-center justify-center">
      {/* Blurry “next” card behind */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mx-auto flex h-[72%] max-h-[480px] w-full items-center justify-center rounded-[30px]"
        style={{
          transform: "translateY(-40px) scale(0.9)",
          opacity: 1,
          transition: "transform 280ms ease-out, opacity 280ms ease-out",
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[30px] border border-mn-border-subtle/40 shadow-mn-card">
          <div className="h-full w-full bg-gradient-to-br from-mn-bg via-mn-bg-elevated to-mn-bg blur-[4px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-mn-bg/0 via-mn-bg/30 to-mn-bg/90" />
        </div>
      </div>

      {/* Main animated card */}
      <article
        className="relative z-10 mx-auto flex h-[72%] max-h-[480px] w-full select-none flex-col overflow-hidden rounded-[30px] border border-mn-border-subtle/70 bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-mn-card backdrop-blur"
        style={{
          transform: `translateX(${offset}px) rotate(${rotation}deg)`,
          transition: "transform 480ms cubic-bezier(0.22,0.61,0.36,1)",
        }}
      >
        <div className="relative h-[58%] overflow-hidden bg-gradient-to-br from-mn-bg/90 via-mn-bg/85 to-mn-bg/95">
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-mn-border-subtle/40 via-mn-border-subtle/20 to-mn-border-subtle/50" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-mn-bg/85" />
          <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-1 font-semibold text-mn-text-muted shadow-mn-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-mn-border-subtle" />
              Signing you in…
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-1 text-[10px] text-mn-text-muted shadow-mn-soft">
              <Sparkles className="h-3 w-3" />
              Getting your nest ready
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between bg-gradient-to-b from-mn-bg/92 via-mn-bg/96 to-mn-bg px-4 pb-4 pt-3 backdrop-blur-md">
          <div className="space-y-3 text-left text-[12px] leading-relaxed">
            <div className="space-y-2">
              <div className="h-5 w-2/3 animate-pulse rounded-full bg-mn-border-subtle/60" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-mn-border-subtle/40" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded-full bg-mn-border-subtle/40" />
              <div className="h-3 w-5/6 animate-pulse rounded-full bg-mn-border-subtle/30" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-mn-text-secondary">
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-surface-elevated/80 px-2 py-1 shadow-mn-soft">
              <Flame className="h-4 w-4 text-mn-border-subtle" />
              Loading your MoviNesta nest…
            </span>
          </div>
        </div>
      </article>
    </div>
  );
};

const RequireAuth: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mn-bg px-4 text-mn-text-secondary">
        <AuthLoadingCard />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/signin" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default RequireAuth;
