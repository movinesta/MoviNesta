import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useAuth } from "./AuthProvider";

const RequireAuth: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth/signin" replace state={{ from: location }} />;
  }

  const onboarded = (user as any)?.user_metadata?.onboarded === true;
  const isOnboardingRoute = location.pathname.startsWith("/onboarding");
  if (!onboarded && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default RequireAuth;
