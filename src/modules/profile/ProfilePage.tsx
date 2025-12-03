// src/modules/profile/ProfilePage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Users,
  UserPlus,
  UserMinus,
  Settings,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";
import { useProfileByUsername } from "./useProfile";
import ProfileActivityTab from "./ProfileActivityTab";
import ProfileDiaryTab from "./ProfileDiaryTab";
import { useToggleFollow } from "../search/useToggleFollow";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

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
  const [startingConversation, setStartingConversation] = useState(false);

  const { data: profile, isLoading, isError, error } = useProfileByUsername(username ?? null);
  const { user } = useAuth();

  const toggleFollow = useToggleFollow();

  const headerTitle = useMemo(() => {
    if (!profile) return username ? `@${username}` : "Profile";
    return profile.displayName || profile.username || "Profile";
  }, [profile, username]);

  if (!username) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-4 pt-2 sm:px-4 lg:px-6">
        <TopBar title="Profile" subtitle="This route needs a username to show someone’s profile." />

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
        <TopBar title="Loading profile" />
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
        <TopBar title="Profile not found" />
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
      navigate("/settings");
      return;
    }

    if (toggleFollow.isPending) return;

    toggleFollow.mutate({
      targetUserId: profile.id,
      currentlyFollowing: profile.isFollowing,
    });
  };

  const handleStartConversation = async () => {
    if (!profile || profile.isCurrentUser) return;

    if (!user?.id) {
      alert("You need to be signed in to message other members.");
      return;
    }

    setStartingConversation(true);

    try {
      const myUserId = user.id;

      const { data: myParticipantRows, error: myParticipantsError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", myUserId);

      if (myParticipantsError) {
        throw myParticipantsError;
      }

      const myConversationIds = (myParticipantRows ?? []).map(
        (row: any) => row.conversation_id as string,
      );

      let directConversationId: string | null = null;

      if (myConversationIds.length > 0) {
        const { data: theirParticipantRows, error: theirParticipantsError } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", profile.id)
          .in("conversation_id", myConversationIds);

        if (theirParticipantsError) {
          throw theirParticipantsError;
        }

        const sharedConversationIds = Array.from(
          new Set((theirParticipantRows ?? []).map((row: any) => row.conversation_id as string)),
        );

        if (sharedConversationIds.length > 0) {
          const { data: existingConversations, error: conversationsError } = await supabase
            .from("conversations")
            .select("id, is_group, updated_at")
            .in("id", sharedConversationIds)
            .eq("is_group", false)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (conversationsError) {
            throw conversationsError;
          }

          if (existingConversations && existingConversations.length > 0) {
            directConversationId = existingConversations[0].id as string;
          }
        }
      }

      if (!directConversationId) {
        const { data: newConversation, error: newConvError } = await supabase
          .from("conversations")
          .insert({
            is_group: false,
            title: null,
            created_by: myUserId,
          })
          .select("id")
          .single();

        if (newConvError) {
          throw newConvError;
        }

        const conversationId = newConversation?.id as string;

        const { error: participantsInsertError } = await supabase
          .from("conversation_participants")
          .insert([
            {
              conversation_id: conversationId,
              user_id: myUserId,
              role: "member",
            },
            {
              conversation_id: conversationId,
              user_id: profile.id,
              role: "member",
            },
          ]);

        if (participantsInsertError) {
          throw participantsInsertError;
        }

        directConversationId = conversationId;
      }

      if (!directConversationId) {
        throw new Error("Failed to start a conversation.");
      }

      navigate(`/messages/${directConversationId}`);
    } catch (err: any) {
      console.error("[ProfilePage] Failed to start conversation", err);
      alert(
        err?.message ?? "Something went wrong while starting the conversation. Please try again.",
      );
    } finally {
      setStartingConversation(false);
    }
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
    <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
      <TopBar
        title={headerTitle}
        subtitle={profile.bio || "See their diary entries, activity, and who they follow."}
      />

      <PageSection>
        <div className="flex flex-col gap-6 rounded-2xl border border-mn-border-subtle bg-gradient-to-r from-mn-bg to-mn-bg-elevated/60 p-4 shadow-mn-card sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-mn-primary/15 via-mn-accent-teal/20 to-mn-bg ring-1 ring-mn-border-subtle/80">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName || profile.username || "Profile avatar"}
                    className="h-20 w-20 rounded-[22px] object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-mn-accent-teal" aria-hidden="true">
                    {getInitials(profile.displayName, profile.username)}
                  </span>
                )}
                {!profile.isCurrentUser && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-mn-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mn-primary ring-1 ring-mn-primary/30">
                    {profile.isFollowing ? "Following" : "New"}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-heading font-semibold text-mn-text-primary">
                    {headerTitle}
                  </h2>
                  {profile.username && (
                    <span className="rounded-full bg-mn-bg px-2 py-0.5 text-[11px] font-mono text-mn-text-secondary ring-1 ring-mn-border-subtle">
                      @{profile.username}
                    </span>
                  )}
                  {profile.isCurrentUser && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mn-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mn-primary ring-1 ring-mn-primary/30">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      You
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-6 text-center text-[12px] text-mn-text-secondary">
                  <div className="flex min-w-[80px] flex-col">
                    <span className="text-base font-semibold text-mn-text-primary">
                      {formatCount(profile.followersCount)}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide">Followers</span>
                  </div>
                  <div className="flex min-w-[80px] flex-col">
                    <span className="text-base font-semibold text-mn-text-primary">
                      {formatCount(profile.followingCount)}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide">Following</span>
                  </div>
                  <div className="flex min-w-[80px] flex-col">
                    <span className="text-base font-semibold text-mn-text-primary">
                      {activeTab === "activity" ? "Activity" : "Diary"}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide">View</span>
                  </div>
                </div>

                {profile.bio && (
                  <p className="max-w-2xl whitespace-pre-line text-[12px] leading-snug text-mn-text-secondary">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-wrap items-start justify-end gap-2">
              {profile.isCurrentUser ? (
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="inline-flex items-center gap-1.5 rounded-full border border-mn-border-subtle bg-mn-bg-elevated px-3 py-1.5 text-[12px] font-semibold text-mn-text-primary shadow-mn-card transition hover:bg-mn-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  <span>Edit profile</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    disabled={toggleFollow.isPending}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold shadow-mn-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg disabled:opacity-60 ${
                      profile.isFollowing
                        ? "border border-mn-border-subtle bg-mn-bg-elevated text-mn-text-primary hover:bg-mn-bg"
                        : "border border-transparent bg-mn-primary text-mn-bg hover:bg-mn-primary/90"
                    }`}
                  >
                    {toggleFollow.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <PrimaryActionIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{primaryActionLabel}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartConversation}
                    disabled={startingConversation}
                    className="inline-flex items-center gap-1.5 rounded-full border border-mn-border-subtle bg-mn-bg-elevated px-3 py-1.5 text-[12px] font-semibold text-mn-text-primary shadow-mn-card transition hover:bg-mn-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {startingConversation ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{startingConversation ? "Starting…" : "Message"}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {!profile.isCurrentUser && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-mn-border-subtle/80 bg-mn-bg/70 px-3 py-2 text-[11px] text-mn-text-secondary shadow-mn-soft">
              <Users className="h-4 w-4 text-mn-primary" aria-hidden="true" />
              <p className="font-medium text-mn-text-primary">
                Follow to catch their latest reviews and diary logs.
              </p>
            </div>
          )}
        </div>
      </PageSection>

      <PageSection tone="muted">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-mn-bg/70 px-3 py-2 text-[11px] text-mn-text-secondary ring-1 ring-mn-border-subtle/70">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-mn-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mn-primary">
                Profile view
              </span>
              <p className="text-mn-text-primary">
                You&apos;re browsing {profile.isCurrentUser ? "your" : "their"} latest activity and{" "}
                diary entries.
              </p>
            </div>
            {!profile.isCurrentUser && profile.username && (
              <span className="rounded-full bg-mn-bg px-2 py-0.5 font-mono text-[10px] text-mn-text-muted ring-1 ring-mn-border-subtle/70">
                @{profile.username}
              </span>
            )}
          </div>

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
            {activeTab === "activity" ? (
              <ProfileActivityTab
                profileId={profile.id}
                displayName={profile.displayName}
                username={profile.username}
                isCurrentUser={profile.isCurrentUser}
              />
            ) : (
              <ProfileDiaryTab
                profileId={profile.id}
                displayName={profile.displayName}
                username={profile.username}
                isCurrentUser={profile.isCurrentUser}
              />
            )}
          </div>
        </div>
      </PageSection>
    </div>
  );
};

export default ProfilePage;
