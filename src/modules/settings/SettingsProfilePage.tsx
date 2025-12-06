import React, { useEffect, useState } from "react";
import { Loader2, User as UserIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";
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

const SettingsProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { data: profile, isLoading, isError, error } = useCurrentProfile();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ProfileFormState>({
    displayName: "",
    bio: "",
    avatarFile: null,
  });

  // Keep local form state in sync with loaded profile
  useEffect(() => {
    if (!profile) return;
    setForm({
      displayName: profile.displayName ?? "",
      bio: profile.bio ?? "",
      avatarFile: null,
    });
  }, [profile]);

  const updateProfile = useMutation<void, Error, ProfileFormState>({
    mutationFn: async ({ displayName, bio, avatarFile }) => {
      if (!user) {
        throw new Error("You need to be signed in to update your profile.");
      }

      let avatarUrl = profile?.avatarUrl ?? null;

      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt ?? "jpg"}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const uploadedPath = uploadData?.path ?? filePath;

        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(uploadedPath);

        avatarUrl = publicUrlData.publicUrl ?? avatarUrl;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
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
    if (!user || !profile || updateProfile.isPending) return;

    await updateProfile.mutateAsync({
      displayName: form.displayName,
      bio: form.bio,
      avatarFile: form.avatarFile,
    });
  };

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="max-w-md rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-4 py-6 text-center text-sm text-mn-text-primary shadow-mn-card">
          <h1 className="text-base font-heading font-semibold">You&apos;re signed out</h1>
          <p className="mt-2 text-xs text-mn-text-secondary">
            Sign in to edit your profile settings.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="flex items-center gap-2 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-4 py-3 text-sm text-mn-text-secondary shadow-mn-card">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Loading your profile…</span>
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-4 py-6 text-center text-sm text-mn-text-primary shadow-mn-card">
          <h1 className="text-base font-heading font-semibold">Profile unavailable</h1>
          <p className="mt-2 text-xs text-mn-text-secondary">
            We couldn&apos;t load your profile right now.
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

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <TopBar
        title="Profile"
        subtitle="Tune the essentials that shape how you appear across MoviNesta."
      />

      {/* Content */}
      <section className="px-1 pb-24">
        <PageSection>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-2 flex items-start gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-border-subtle/50">
                <UserIcon className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
              </span>
              <div className="space-y-0.5">
                <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
                  Public profile
                </h2>
                <p className="text-[11px] text-mn-text-secondary">
                  Your profile is shown on your diary, reviews, and social features.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <AvatarPicker
                initialUrl={profile.avatarUrl}
                description="Upload a square image (PNG/JPG) to use across the app."
                disabled={updateProfile.isPending}
                onFileChange={(file) => setForm((prev) => ({ ...prev, avatarFile: file }))}
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="displayName"
                  className="block text-[11px] font-medium uppercase tracking-[0.16em] text-mn-text-muted"
                >
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={form.displayName}
                  onChange={handleChange("displayName")}
                  maxLength={80}
                  className="w-full rounded-md border border-mn-border-subtle bg-mn-bg px-3 py-2 text-sm text-mn-text-primary shadow-sm outline-none ring-0 placeholder:text-mn-text-muted focus:border-mn-border-strong focus:ring-2 focus:ring-mn-border-strong/40"
                  placeholder="How should we show your name?"
                />
                <p className="text-[10px] text-mn-text-muted">
                  This is the name other people see on your profile and activity.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="bio"
                  className="block text-[11px] font-medium uppercase tracking-[0.16em] text-mn-text-muted"
                >
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={form.bio}
                  onChange={handleChange("bio")}
                  rows={4}
                  maxLength={280}
                  className="w-full resize-none rounded-md border border-mn-border-subtle bg-mn-bg px-3 py-2 text-sm text-mn-text-primary shadow-sm outline-none ring-0 placeholder:text-mn-text-muted focus:border-mn-border-strong focus:ring-2 focus:ring-mn-border-strong/40"
                  placeholder="Tell people a bit about your taste in movies."
                />
                <p className="text-[10px] text-mn-text-muted">
                  You can use multiple lines. Keep it short and cinematic.
                </p>
              </div>
            </div>

            {/* Status */}
            {(updateProfile.isError || updateProfile.isSuccess) && (
              <div className="pt-1 text-[11px]">
                {updateProfile.isError && (
                  <div className="flex items-center gap-1.5 text-mn-error">
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
              <button
                type="button"
                className="rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-mn-text-secondary hover:bg-mn-border-subtle/40"
                onClick={() => {
                  if (profile) {
                    setForm({
                      displayName: profile.displayName ?? "",
                      bio: profile.bio ?? "",
                      avatarFile: null,
                    });
                    updateProfile.reset();
                  }
                }}
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-mn-accent/90 px-3.5 py-1.5 text-xs font-medium text-black shadow-mn-card transition hover:bg-mn-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg disabled:cursor-not-allowed disabled:opacity-70"
              >
                {updateProfile.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                )}
                <span>Save changes</span>
              </button>
            </div>
          </form>
        </PageSection>
      </section>
    </div>
  );
};

export default SettingsProfilePage;
