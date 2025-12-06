import React, { useEffect, useState } from "react";
import {
  Bell,
  Inbox,
  ThumbsUp,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TopBar from "../../components/shared/TopBar";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import type { Database } from "@/types/supabase";

type NotificationPreferencesRow =
  Database["public"]["Tables"]["notification_preferences"]["Row"];

type NotificationPrefs = {
  emailActivity: boolean;
  emailRecommendations: boolean;
  inAppSocial: boolean;
  inAppSystem: boolean;
};

type UpdateNotificationPrefsResponse = {
  ok: boolean;
  error?: string;
  code?: string;
  preferences: NotificationPrefs & { updatedAt: string };
};

const defaultPrefs: NotificationPrefs = {
  emailActivity: true,
  emailRecommendations: true,
  inAppSocial: true,
  inAppSystem: true,
};

const notificationPreferencesQueryKey = ["notification-preferences"] as const;

const SettingsNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const {
    data: storedPrefs,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: notificationPreferencesQueryKey,
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error: fetchError } = await supabase
        .from("notification_preferences")
        .select(
          "user_id, email_activity, email_recommendations, in_app_social, in_app_system, updated_at",
        )
        .eq("user_id", user!.id)
        .maybeSingle<NotificationPreferencesRow>();

      if (fetchError) {
        throw fetchError;
      }

      if (data) return data;

      return {
        user_id: user!.id,
        email_activity: defaultPrefs.emailActivity,
        email_recommendations: defaultPrefs.emailRecommendations,
        in_app_social: defaultPrefs.inAppSocial,
        in_app_system: defaultPrefs.inAppSystem,
        updated_at: new Date().toISOString(),
      } satisfies NotificationPreferencesRow;
    },
  });

  useEffect(() => {
    if (!storedPrefs) return;

    setPrefs({
      emailActivity: storedPrefs.email_activity,
      emailRecommendations: storedPrefs.email_recommendations,
      inAppSocial: storedPrefs.in_app_social,
      inAppSystem: storedPrefs.in_app_system,
    });
  }, [storedPrefs]);

  const savePrefs = useMutation({
    mutationFn: async (next: NotificationPrefs) => {
      const response = await callSupabaseFunction<UpdateNotificationPrefsResponse>(
        "update-notification-prefs",
        {
          emailActivity: next.emailActivity,
          emailRecommendations: next.emailRecommendations,
          inAppSocial: next.inAppSocial,
          inAppSystem: next.inAppSystem,
        },
      );

      if (!response.ok) {
        throw new Error(response.error ?? "Unable to save preferences");
      }

      return response.preferences;
    },
    onSuccess: (updated) => {
      setStatus("saved");
      queryClient.setQueryData<NotificationPreferencesRow>(
        notificationPreferencesQueryKey,
        {
          user_id: user?.id ?? "",
          email_activity: updated.emailActivity,
          email_recommendations: updated.emailRecommendations,
          in_app_social: updated.inAppSocial,
          in_app_system: updated.inAppSystem,
          updated_at: updated.updatedAt,
        },
      );
    },
    onError: (err) => {
      console.error("Failed to save notification preferences", err);
      setStatus("error");
    },
  });

  const updateField =
    (field: keyof NotificationPrefs) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setPrefs((prev) => ({ ...prev, [field]: event.target.checked }));
      setStatus("idle");
    };

  const handleSave = async () => {
    if (!user || savePrefs.isPending) return;

    await savePrefs.mutateAsync(prefs);
  };

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="max-w-md rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-4 py-6 text-center text-sm text-mn-text-primary shadow-mn-card">
          <h1 className="text-base font-heading font-semibold">You&apos;re signed out</h1>
          <p className="mt-2 text-xs text-mn-text-secondary">
            Sign in to manage how MoviNesta contacts you.
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
          <span>Loading your notification preferences…</span>
        </div>
      </div>
    );
  }

  if (isError || !storedPrefs) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-4 py-6 text-center text-sm text-mn-text-primary shadow-mn-card">
          <h1 className="text-base font-heading font-semibold">Notifications unavailable</h1>
          <p className="mt-2 text-xs text-mn-text-secondary">
            We couldn&apos;t load your preferences right now.
          </p>
          {error && (
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
      <TopBar title="Notifications" subtitle="Control how MoviNesta keeps in touch with you." />

      <div className="mx-4 flex items-start gap-2 rounded-md border border-mn-border-subtle/70 bg-mn-bg-elevated/70 p-3 text-[12px] text-mn-text-secondary shadow-mn-card">
        <Info className="mt-0.5 h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
        <p className="leading-relaxed">
          Notification preferences are saved to your MoviNesta account and sync across devices.
          These toggles control both in-app surfaces and any email digests you opt into.
        </p>
      </div>

      <section className="space-y-4 px-4 pb-24">
        {/* Email */}
        <div className="space-y-3 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 p-4 shadow-mn-card">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-border-subtle/50">
              <Inbox className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">Email</h2>
              <p className="text-[11px] text-mn-text-secondary">
                Occasional updates from MoviNesta in your inbox.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 text-[12px]">
            <label className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-mn-text-primary">Activity on your content</span>
                <span className="block text-[11px] text-mn-text-secondary">
                  New followers, comments, and reactions.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.emailActivity}
                onChange={updateField("emailActivity")}
                className="mt-1 h-4 w-4 rounded border-mn-border-subtle bg-mn-bg text-mn-accent"
                aria-label="Email activity notifications"
              />
            </label>

            <label className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-mn-text-primary">Recommendations</span>
                <span className="block text-[11px] text-mn-text-secondary">
                  Personalized movie picks and weekly digests.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.emailRecommendations}
                onChange={updateField("emailRecommendations")}
                className="mt-1 h-4 w-4 rounded border-mn-border-subtle bg-mn-bg text-mn-accent"
                aria-label="Email recommendations"
              />
            </label>
          </div>
        </div>

        {/* In-app */}
        <div className="space-y-3 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 p-4 shadow-mn-card">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-border-subtle/50">
              <Bell className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
                In-app notifications
              </h2>
              <p className="text-[11px] text-mn-text-secondary">
                What shows up inside the app. Push and OS-level settings still apply.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 text-[12px]">
            <label className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-mn-text-primary">Social activity</span>
                <span className="block text-[11px] text-mn-text-secondary">
                  Follows, reactions, and friend activity.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.inAppSocial}
                onChange={updateField("inAppSocial")}
                className="mt-1 h-4 w-4 rounded border-mn-border-subtle bg-mn-bg text-mn-accent"
                aria-label="In-app social notifications"
              />
            </label>

            <label className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-mn-text-primary">System messages</span>
                <span className="block text-[11px] text-mn-text-secondary">
                  Account notices, billing, and other important updates.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.inAppSystem}
                onChange={updateField("inAppSystem")}
                className="mt-1 h-4 w-4 rounded border-mn-border-subtle bg-mn-bg text-mn-accent"
                aria-label="In-app system messages"
              />
            </label>
          </div>
        </div>

        {/* Status + save */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-h-[20px] flex-1 text-[11px]">
            {status === "saved" && (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Notification preferences saved to your account.</span>
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center gap-1.5 text-mn-error">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Couldn&apos;t save preferences. Try again.</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={savePrefs.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-mn-accent/90 px-3.5 py-1.5 text-xs font-medium text-black shadow-mn-card transition hover:bg-mn-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg disabled:cursor-not-allowed disabled:opacity-70"
          >
            {savePrefs.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{savePrefs.isPending ? "Saving…" : "Save preferences"}</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsNotificationsPage;
