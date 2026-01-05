import React, { useState } from "react";
import { Loader2, User as UserIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useCurrentProfile } from "../profile/useProfile";
import AvatarPicker from "../../components/forms/AvatarPicker";

interface ProfileFormState {
  displayName: string;
  bio: string;
  avatarFile: File | null;
}

const ProfileForm: React.FC<{
  initialProfile: { displayName: string; bio: string; avatarUrl: string | null };
  user: { id: string };
}> = ({ initialProfile, user }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileFormState>({
    displayName: initialProfile.displayName,
    bio: initialProfile.bio,
    avatarFile: null,
  });

  const updateProfile = useMutation<void, Error, ProfileFormState>({
    mutationFn: async ({ displayName, bio, avatarFile }) => {
      // We store the storage *path* in profiles.avatar_url and resolve it to a signed URL when rendering.
      let avatarPathOrUrl = initialProfile.avatarUrl;

      if (avatarFile) {
        const fileExtRaw = avatarFile.name.split(".").pop() ?? "";
        const fileExt = fileExtRaw.trim().toLowerCase();
        const allowedExt = new Set(["jpg", "jpeg", "png", "webp"]);
        if (!allowedExt.has(fileExt)) {
          throw new Error("Please upload a JPG, PNG, or WebP image.");
        }

        const contentTypeByExt: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
        };

        const filePath = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: contentTypeByExt[fileExt] ?? "application/octet-stream",
          });

        if (uploadError) {
          throw uploadError;
        }

        const uploadedPath = uploadData?.path ?? filePath;
        avatarPathOrUrl = uploadedPath;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          bio: bio.trim(),
          avatar_url: avatarPathOrUrl ?? "",
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }
    },
    onSuccess: () => {
      // Refresh any profile views (including /u/:username and useCurrentProfile)
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setForm((prev) => ({ ...prev, avatarFile: null }));
    },
  });

  const handleChange =
    (field: keyof ProfileFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (updateProfile.isPending) return;

    await updateProfile.mutateAsync({
      displayName: form.displayName,
      bio: form.bio,
      avatarFile: form.avatarFile,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-2 flex items-start gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-border/50">
          <UserIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <div className="space-y-0.5">
          <h2 className="text-sm font-heading font-semibold text-foreground">Public profile</h2>
          <p className="text-xs text-muted-foreground">
            Your profile is shown on your diary, reviews, and social features.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <AvatarPicker
          initialUrl={initialProfile.avatarUrl}
          description="Upload a square image (PNG/JPG) to use across the app."
          disabled={updateProfile.isPending}
          onFileChange={(file) => setForm((prev) => ({ ...prev, avatarFile: file }))}
        />

        <div className="space-y-1.5">
          <label
            htmlFor="displayName"
            className="block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"
          >
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={form.displayName}
            onChange={handleChange("displayName")}
            maxLength={80}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-border focus:ring-2 focus:ring-border/40"
            placeholder="How should we show your name?"
          />
          <p className="text-xs text-muted-foreground">
            This is the name other people see on your profile and activity.
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="bio"
            className="block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"
          >
            Bio
          </label>
          <textarea
            id="bio"
            value={form.bio}
            onChange={handleChange("bio")}
            rows={4}
            maxLength={280}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-border focus:ring-2 focus:ring-border/40"
            placeholder="Tell people a bit about your taste in movies."
          />
          <p className="text-xs text-muted-foreground">
            You can use multiple lines. Keep it short and cinematic.
          </p>
        </div>
      </div>

      {/* Status */}
      {(updateProfile.isError || updateProfile.isSuccess) && (
        <div className="pt-1 text-xs">
          {updateProfile.isError && (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{updateProfile.error?.message ?? "Couldn’t save changes."}</span>
            </div>
          )}
          {updateProfile.isSuccess && !updateProfile.isError && (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Profile updated.</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setForm({
              displayName: initialProfile.displayName,
              bio: initialProfile.bio,
              avatarFile: null,
            });
            updateProfile.reset();
          }}
        >
          Reset
        </Button>
        <Button type="submit" size="sm" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <span>Save changes</span>
          )}
        </Button>
      </div>
    </form>
  );
};

const SettingsProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { data: profile, isLoading, isError, error } = useCurrentProfile();

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card/80 px-4 py-6 text-center text-sm text-foreground shadow-lg">
          <h1 className="text-base font-heading font-semibold">You&apos;re signed out</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Sign in to edit your profile settings.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingScreen message="Loading your profile…" />;
  }

  if (isError || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card/80 px-4 py-6 text-center text-sm text-foreground shadow-lg">
          <h1 className="text-base font-heading font-semibold">Profile unavailable</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            We couldn&apos;t load your profile right now.
          </p>
          {error?.message && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-semibold">Details:</span> {error.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  const initialProfile = {
    displayName: (profile as any).displayName ?? "",
    bio: (profile as any).bio ?? "",
    avatarUrl: (profile as any).avatarUrl ?? null,
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <TopBar title="Profile" />

      {/* Content */}
      <section className="px-1 pb-24">
        <PageSection>
          <ProfileForm
            initialProfile={initialProfile}
            user={user}
            key={
              (profile as any)?.displayName +
              ((profile as any)?.bio ?? "") +
              ((profile as any)?.avatarUrl ?? "")
            } // Re-mount if profile data changes remotely
          />
        </PageSection>
      </section>
    </div>
  );
};

export default SettingsProfilePage;
