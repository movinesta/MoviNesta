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
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
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
          <p className="text-sm text-muted-foreground">
            Make sure you are visiting a URL like
            <span className="mx-1 rounded bg-card px-1.5 py-0.5 font-mono text-xs">
              /u/&lt;username&gt;
            </span>
            so we know whose profile to display.
          </p>
        </PageSection>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingScreen message="Fetching profile details…" />;
  }

  if (isError || !profile) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-4 pt-2 sm:px-4 lg:px-6">
        <TopBar title="Profile not found" />
        <PageSection>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find a profile for username
            <span className="mx-1 rounded bg-card px-1.5 py-0.5 font-mono text-xs">
              @{username}
            </span>
            .
          </p>
          {error?.message && (
            <p className="mt-3 text-xs text-muted-foreground">
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
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-gradient-to-r from-background to-card/60 p-4 shadow-lg sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-primary/15 via-primary/20 to-background ring-1 ring-border/80">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName || profile.username || "Profile avatar"}
                    className="h-20 w-20 rounded-[22px] object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-primary" aria-hidden="true">
                    {getInitials(profile.displayName, profile.username)}
                  </span>
                )}
                {!profile.isCurrentUser && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/30">
                    {profile.isFollowing ? "Following" : "New"}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-heading font-semibold text-foreground">
                    {headerTitle}
                  </h2>
                  {profile.username && (
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs font-mono text-muted-foreground ring-1 ring-border">
                      @{profile.username}
                    </span>
                  )}
                  {profile.isCurrentUser && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/30">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      You
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-6 text-center text-[12px] text-muted-foreground">
                  <div className="flex min-w-[80px] flex-col">
                    <span className="text-base font-semibold text-foreground">
                      {formatCount(profile.followersCount)}
                    </span>
                    <span className="text-xs uppercase tracking-wide">Followers</span>
                  </div>
                  <div className="flex min-w-[80px] flex-col">
                    <span className="text-base font-semibold text-foreground">
                      {formatCount(profile.followingCount)}
                    </span>
                    <span className="text-xs uppercase tracking-wide">Following</span>
                  </div>
                  <div className="flex min-w-[80px] flex-col">
                    <span className="text-base font-semibold text-foreground">
                      {activeTab === "activity" ? "Activity" : "Diary"}
                    </span>
                    <span className="text-xs uppercase tracking-wide">View</span>
                  </div>
                </div>

                {profile.bio && (
                  <p className="max-w-2xl whitespace-pre-line text-[12px] leading-snug text-muted-foreground">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-wrap items-start justify-end gap-2">
              {profile.isCurrentUser ? (
                <Button type="button" variant="outline" size="sm" onClick={handlePrimaryAction}>
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  <span>Edit profile</span>
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePrimaryAction}
                    disabled={toggleFollow.isPending}
                    className={
                      profile.isFollowing
                        ? "border border-border bg-card text-foreground hover:bg-background"
                        : ""
                    }
                  >
                    {toggleFollow.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <PrimaryActionIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{primaryActionLabel}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStartConversation}
                    disabled={startingConversation}
                  >
                    {startingConversation ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{startingConversation ? "Starting…" : "Message"}</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {!profile.isCurrentUser && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground shadow-md">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="font-medium text-foreground">
                Follow to catch their latest reviews and diary logs.
              </p>
            </div>
          )}
        </div>
      </PageSection>

      <PageSection tone="muted">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground ring-1 ring-border/70">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                Profile view
              </span>
              <p className="text-foreground">
                You&apos;re browsing {profile.isCurrentUser ? "your" : "their"} latest activity and{" "}
                diary entries.
              </p>
            </div>
            {!profile.isCurrentUser && profile.username && (
              <span className="rounded-full bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground ring-1 ring-border/70">
                @{profile.username}
              </span>
            )}
          </div>

          <nav
            className="flex items-center gap-1.5 rounded-lg bg-muted p-1.5 text-xs text-muted-foreground"
            aria-label="Profile tabs"
          >
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={`inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all ${
                activeTab === "activity"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/80"
              }`}
              aria-pressed={activeTab === "activity"}
            >
              Activity
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("diary")}
              className={`inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all ${
                activeTab === "diary"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/80"
              }`}
              aria-pressed={activeTab === "diary"}
            >
              Diary
            </button>
          </nav>

          <div
            aria-live="polite"
            className="rounded-xl border border-border bg-card/60 px-3 py-3 shadow-md"
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
