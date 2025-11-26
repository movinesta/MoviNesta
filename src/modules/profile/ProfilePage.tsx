// src/modules/profile/ProfilePage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { User, Users, UserPlus, UserMinus, Settings, Loader2 } from "lucide-react";
import { useProfileByUsername } from "./useProfile";
import ProfileActivityTab from "./ProfileActivityTab";
import ProfileDiaryTab from "./ProfileDiaryTab";
import { useToggleFollow } from "../search/useToggleFollow";

type ProfileTabKey = "activity" | "diary";

const formatCount = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(value ?? 0);
};

const getInitials = (displayName: string | null, username: string | null): string => {
  const source = displayName || username || "";
  const cleaned = source.replace(/^@/, "").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("activity");

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useProfileByUsername(username ?? null);

  const toggleFollow = useToggleFollow();

  const headerTitle = useMemo(() => {
    if (!profile) return username ? `@${username}` : "Profile";
    return profile.displayName || profile.username || "Profile";
  }, [profile, username]);

  if (!username) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 px-4 py-6 text-center text-sm text-mn-text-primary shadow-mn-card">
          <h1 className="text-base font-heading font-semibold">Profile</h1>
          <p className="mt-2 text-xs text-mn-text-secondary">
            This profile route is missing a username. Make sure you are visiting a URL like{" "}
            <span className="mx-1 rounded bg-mn-bg-elevated px-1.5 py-0.5 font-mono text-[11px]">
              /u/&lt;username&gt;
            </span>
            .
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="flex items-center gap-2 rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 px-4 py-3 text-sm text-mn-text-secondary shadow-mn-card">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Loading profile…</span>
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 px-4 py-6 text-center text-sm text-mn-text-primary shadow-mn-card">
          <h1 className="text-base font-heading font-semibold">Profile not found</h1>
          <p className="mt-2 text-xs text-mn-text-secondary">
            We couldn&apos;t find a profile for username{" "}
            <span className="rounded bg-mn-bg-elevated px-1.5 py-0.5 font-mono text-[11px]">
              @{username}
            </span>
            .
          </p>
          {error?.message && (
            <p className="mt-2 text-[11px] text-mn-text-muted">
              <span className="font-semibold">Details:</span> {error.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  const handlePrimaryAction = async () => {
    if (!profile) return;

    if (profile.isCurrentUser) {
      navigate("/settings/profile");
      return;
    }

    if (toggleFollow.isPending) return;

    toggleFollow.mutate({
      targetUserId: profile.id,
      currentlyFollowing: profile.isFollowing,
    });
  };

  const primaryActionLabel = profile.isCurrentUser
    ? "Edit profile"
    : profile.isFollowing
      ? "Following"
      : "Follow";

  const PrimaryActionIcon = profile.isCurrentUser
    ? Settings
    : profile.isFollowing
      ? UserMinus
      : UserPlus;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      {/* Header */}
      <header className="px-3 pt-1">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-mn-accent-teal/20 text-base font-semibold text-mn-accent-teal">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName || profile.username || "Profile avatar"}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span aria-hidden="true">{getInitials(profile.displayName, profile.username)}</span>
            )}
          </div>

          {/* Text meta */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-heading font-semibold text-mn-text-primary">
                {headerTitle}
              </h1>
              {profile.username && (
                <span className="rounded bg-mn-bg-elevated px-1.5 py-0.5 text-[11px] font-mono text-mn-text-secondary">
                  @{profile.username}
                </span>
              )}
            </div>

            {profile.bio && (
              <p className="whitespace-pre-line text-[11px] leading-snug text-mn-text-secondary">
                {profile.bio}
              </p>
            )}

            {/* Counts */}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-mn-text-secondary">
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  <span className="font-semibold text-mn-text-primary">
                    {formatCount(profile.followersCount)}
                  </span>{" "}
                  followers
                </span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  <span className="font-semibold text-mn-text-primary">
                    {formatCount(profile.followingCount)}
                  </span>{" "}
                  following
                </span>
              </div>
            </div>
          </div>

          {/* Primary action */}
          <div className="flex items-start">
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={toggleFollow.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-mn-border-subtle bg-mn-bg-elevated px-3 py-1.5 text-[11px] font-medium text-mn-text-primary shadow-mn-card hover:bg-mn-bg-elevated/80 disabled:opacity-60"
            >
              {toggleFollow.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <PrimaryActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{primaryActionLabel}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <section className="px-3">
        <nav
          className="mt-2 flex items-center gap-2 rounded-full bg-mn-bg-elevated/70 p-1 text-[11px]"
          aria-label="Profile tabs"
        >
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`flex-1 rounded-full px-3 py-1.5 text-center font-medium ${
              activeTab === "activity"
                ? "bg-mn-bg-elevated shadow-mn-card text-mn-text-primary"
                : "text-mn-text-secondary hover:text-mn-text-primary"
            }`}
            aria-pressed={activeTab === "activity"}
          >
            Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("diary")}
            className={`flex-1 rounded-full px-3 py-1.5 text-center font-medium ${
              activeTab === "diary"
                ? "bg-mn-bg-elevated shadow-mn-card text-mn-text-primary"
                : "text-mn-text-secondary hover:text-mn-text-primary"
            }`}
            aria-pressed={activeTab === "diary"}
          >
            Diary
          </button>
        </nav>
      </section>

      {/* Tab panels */}
      <section aria-live="polite" className="flex-1">
  {activeTab === "activity" ? (
    <ProfileActivityTab />
  ) : (
    <ProfileDiaryTab />
  )}
</section>
    </div>
  );
};

export default ProfilePage;
