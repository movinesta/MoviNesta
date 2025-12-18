import React, { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Sparkles, Flame } from "lucide-react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
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

  return <Outlet />;
};

export default RequireAuth;
