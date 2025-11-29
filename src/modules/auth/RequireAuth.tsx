import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Fingerprint, Mail, MessagesSquare } from "lucide-react";
import { useAuth } from "./AuthProvider";
import FullScreenLoader from "../../components/shared/FullScreenLoader";

const RequireAuth: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <FullScreenLoader
        title="Signing you in"
        message="Restoring your preferences, inbox, and recommendations so you can dive right back in."
        badge="Securing your session"
        highlights={[
          {
            title: "Verifying your session",
            description: "Reconnecting with Supabase and renewing your authentication tokens.",
            icon: Fingerprint,
          },
          {
            title: "Syncing your conversations",
            description: "Making sure your latest chats and notifications are ready to open instantly.",
            icon: MessagesSquare,
          },
          {
            title: "Personalizing recommendations",
            description: "Loading your watch diary and taste profile so your feed feels familiar.",
          },
          {
            title: "Checking for updates",
            description: "Confirming your profile, settings, and inbox are fresh before we continue.",
            icon: Mail,
          },
        ]}
      />
    );
  }

  if (!user) {
    return <Navigate to="/auth/signin" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default RequireAuth;
