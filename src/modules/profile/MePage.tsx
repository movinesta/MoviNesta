import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
    }
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
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="max-w-sm rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-center text-xs text-foreground shadow-lg">
            <p className="font-semibold">Unable to load your profile.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error?.message ?? "Please try again in a moment."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Logged in but no username configured.
  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Profile" />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="max-w-sm rounded-2xl border border-border bg-card/80 p-5 text-center text-xs text-muted-foreground shadow-lg">
          <p className="font-heading text-sm font-semibold text-foreground">Finish setting up</p>
          <p className="mt-1 text-xs">Add a username so we can create your profile link.</p>
          <Button type="button" className="mt-4" onClick={() => navigate("/settings/profile")}>
            Set username
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MePage;
