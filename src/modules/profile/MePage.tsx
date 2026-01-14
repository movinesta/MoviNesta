import React from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentProfile, type ProfileSummary } from "./useProfile";
import TopBar from "@/components/shared/TopBar";

/**
 * /me
 *
 * A convenience route for "My Profile".
 * - If the current user has a username, redirect to /u/:username
 * - Otherwise, send them to the profile settings page to set one.
 */
const MePage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useCurrentProfile();
  const profile = data as ProfileSummary | null | undefined;

  React.useEffect(() => {
    if (!profile) return;
    if (profile.username) {
      navigate(`/u/${profile.username}`, { replace: true });
      return;
    }
    navigate("/settings/profile", { replace: true });
  }, [navigate, profile]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title={profile?.username ?? "Profile"} />
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
          Loading your profile…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Profile" />
        <div className="flex flex-1 items-center justify-center page-pad-all">
          <div className="max-w-sm rounded-2xl border border-destructive/40 bg-destructive/5 card-pad text-center text-xs text-foreground shadow-lg">
            <p className="font-semibold">Unable to load your profile.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error?.message ?? "Please try again in a moment."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Logged in but no username configured; navigation effect will handle redirect.
  return null;
};

export default MePage;
