// src/modules/profile/ProfilePage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { User, Users, UserPlus, UserMinus, Settings, Loader2 } from "lucide-react";
import { PageHeader, PageSection } from "../../components/PageChrome";
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

  const { data: profile, isLoading, isError, error } = useProfileByUsername(username ?? null);

  const toggleFollow = useToggleFollow();

  const headerTitle = useMemo(() => {
    if (!profile) return username ? `@${username}` : "Profile";
    return profile.displayName || profile.username || "Profile";
  }, [profile, username]);

  if (!username) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-4 pt-2 sm:px-4 lg:px-6">
        <PageHeader
          title="Profile"
          description="This route needs a username to show someone’s profile."
          icon={Users}
          alignment="left"
        />

        <PageSection>
          <p className="text-sm text-mn-text-secondary">
            Make sure you are visiting a URL like
            <span className="mx-1 rounded bg-mn-bg-elevated px-1.5 py-0.5 font-mono text-[11px]">
              /u/&lt;username&gt;
            </span>
            so we know whose profile to display.
          </p>
        </PageSection>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-4 pt-2 sm:px-4 lg:px-6">
        <PageHeader title="Loading profile" icon={Users} />
        <PageSection>
          <div className="flex items-center gap-2 text-sm text-mn-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Fetching profile details…</span>
          </div>
        </PageSection>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-4 pt-2 sm:px-4 lg:px-6">
        <PageHeader title="Profile not found" icon={Users} />
        <PageSection>
          <p className="text-sm text-mn-text-secondary">
            We couldn&apos;t find a profile for username
            <span className="mx-1 rounded bg-mn-bg-elevated px-1.5 py-0.5 font-mono text-[11px]">
              @{username}
            </span>
            .
          </p>
          {error?.message && (
            <p className="mt-3 text-[11px] text-mn-text-muted">
              <span className="font-semibold">Details:</span> {error.message}
            </p>
          )}
        </PageSection>
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
    <div className="flex flex-1 flex-col gap-4 px-3 pb-4 pt-2 sm:px-4 lg:px-6">
      <PageHeader
        title={headerTitle}
        description={profile.bio || "See their diary entries, activity, and who they follow."}
        icon={Users}
        actions={
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={toggleFollow.isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-mn-border-subtle bg-mn-bg-elevated px-3 py-1.5 text-[11px] font-medium text-mn-text-primary shadow-mn-card transition hover:bg-mn-bg-elevated/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg disabled:opacity-60"
          >
            {toggleFollow.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <PrimaryActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{primaryActionLabel}</span>
          </button>
        }
      />

      <PageSection>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-mn-primary/15 via-mn-accent-teal/15 to-mn-bg text-base font-semibold text-mn-accent-teal ring-1 ring-mn-border-subtle/70">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName || profile.username || "Profile avatar"}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <span aria-hidden="true">{getInitials(profile.displayName, profile.username)}</span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-heading font-semibold text-mn-text-primary">
                  {headerTitle}
                </h2>
                {profile.username && (
                  <span className="rounded-full bg-mn-bg px-2 py-0.5 text-[11px] font-mono text-mn-text-secondary ring-1 ring-mn-border-subtle">
                    @{profile.username}
                  </span>
                )}
              </div>

              {profile.bio && (
                <p className="max-w-2xl whitespace-pre-line text-[11.5px] leading-snug text-mn-text-secondary">
                  {profile.bio}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-mn-text-secondary">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-mn-bg/80 px-2.5 py-1 ring-1 ring-mn-border-subtle/70">
                  <Users className="h-3.5 w-3.5 text-mn-primary" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-mn-text-primary">
                      {formatCount(profile.followersCount)}
                    </span>{" "}
                    followers
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-mn-bg/80 px-2.5 py-1 ring-1 ring-mn-border-subtle/70">
                  <User className="h-3.5 w-3.5 text-mn-primary" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-mn-text-primary">
                      {formatCount(profile.followingCount)}
                    </span>{" "}
                    following
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end">
            {!profile.isCurrentUser && (
              <div className="rounded-2xl border border-dashed border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-2 text-[11px] text-mn-text-secondary shadow-mn-soft">
                <p className="font-semibold text-mn-text-primary">Follow to see updates</p>
                <p className="text-[11px] text-mn-text-muted">
                  Stay in the loop when they log films or share reviews.
                </p>
              </div>
            )}
          </div>
        </div>
      </PageSection>

      <PageSection tone="muted">
        <div className="flex flex-col gap-3">
          <nav
            className="flex items-center gap-2 rounded-full bg-mn-bg/80 p-1 text-[11px]"
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

          <div
            aria-live="polite"
            className="rounded-xl border border-mn-border-subtle/60 bg-mn-bg-elevated/60 px-3 py-3 shadow-mn-soft"
          >
            {activeTab === "activity" ? <ProfileActivityTab /> : <ProfileDiaryTab />}
          </div>
        </div>
      </PageSection>
    </div>
  );
};

export default ProfilePage;
