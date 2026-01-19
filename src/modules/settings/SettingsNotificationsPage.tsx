import React, { useState } from "react";
import { Bell, Inbox, ThumbsUp, AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TopBar from "../../components/shared/TopBar";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";

export interface NotificationPrefs {
  emailActivity: boolean;
  emailRecommendations: boolean;
  inAppSocial: boolean;
  inAppSystem: boolean;
}

const defaultPrefs: NotificationPrefs = {
  emailActivity: true,
  emailRecommendations: true,
  inAppSocial: true,
  inAppSystem: true,
};

const notificationPreferencesQueryKey = ["settings", "notifications"];

interface UpdateNotificationPrefsResponse {
  ok: boolean;
  error?: string;
  preferences: NotificationPrefs;
}

const NotificationsForm: React.FC<{
  initialPrefs: NotificationPrefs;
  user: any;
  onSave: (next: NotificationPrefs) => Promise<any>;
}> = ({ initialPrefs, onSave }) => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("idle");
    try {
      await onSave(prefs);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } finally {
      setSaving(false);
    }
  };

  const isChanged = JSON.stringify(prefs) !== JSON.stringify(initialPrefs);

  return (
    <div className="space-y-6 px-4">
      <div className="space-y-4">
        <PreferenceToggle
          icon={<Bell className="h-4 w-4" />}
          title="Email Activity"
          description="Get notified about new followers and activity."
          enabled={prefs.emailActivity}
          onToggle={() => toggle("emailActivity")}
        />
        <PreferenceToggle
          icon={<ThumbsUp className="h-4 w-4" />}
          title="Recommendations"
          description="Periodic emails with personalized media picks."
          enabled={prefs.emailRecommendations}
          onToggle={() => toggle("emailRecommendations")}
        />
        <PreferenceToggle
          icon={<Inbox className="h-4 w-4" />}
          title="Social Notifications"
          description="In-app alerts for likes, comments, and mentions."
          enabled={prefs.inAppSocial}
          onToggle={() => toggle("inAppSocial")}
        />
        <PreferenceToggle
          icon={<AlertCircle className="h-4 w-4" />}
          title="System Notifications"
          description="Important updates about your account and the app."
          enabled={prefs.inAppSystem}
          onToggle={() => toggle("inAppSystem")}
        />
      </div>

      <div className="flex items-center gap-3 pt-4">
        <Button onClick={handleSave} disabled={saving || !isChanged} className="rounded-full px-6">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        {status === "saved" && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Saved successfully
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1.5 text-xs text-destructive font-medium">
            <AlertCircle className="h-4 w-4" />
            Failed to save preferences
          </span>
        )}
      </div>
    </div>
  );
};

const PreferenceToggle = ({ icon, title, description, enabled, onToggle }: any) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-card/60 p-4 shadow-sm transition-all hover:bg-card/80">
    <div className="flex gap-3">
      <div className="mt-0.5 rounded-full bg-secondary/80 p-2 text-muted-foreground shadow-inner">
        {icon}
      </div>
      <div className="space-y-0.5">
        <h3 className="text-sm font-heading font-semibold text-foreground leading-none">{title}</h3>
        <p className="text-[11px] leading-tight text-muted-foreground">{description}</p>
      </div>
    </div>
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        enabled
          ? "bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]"
          : "bg-muted shadow-inner"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  </div>
);

const SettingsNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
        .from("user_preferences")
        .select("notifications, updated_at")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const n = (data as any)?.notifications || {};
      return {
        emailActivity: n.emailActivity ?? defaultPrefs.emailActivity,
        emailRecommendations: n.emailRecommendations ?? defaultPrefs.emailRecommendations,
        inAppSocial: n.inAppSocial ?? defaultPrefs.inAppSocial,
        inAppSystem: n.inAppSystem ?? defaultPrefs.inAppSystem,
        updated_at: (data as any)?.updated_at || new Date().toISOString(),
      };
    },
  });

  const saveToSupabase = async (next: NotificationPrefs) => {
    const response = await callSupabaseFunction<UpdateNotificationPrefsResponse>(
      "update-notification-prefs",
      next,
    );

    if (!response.ok) {
      throw new Error(response.error ?? "Unable to save preferences");
    }

    queryClient.invalidateQueries({ queryKey: notificationPreferencesQueryKey });
    return response.preferences;
  };

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card/80 px-4 py-6 text-center text-sm text-foreground shadow-sm">
          <h1 className="text-base font-heading font-semibold">You&apos;re signed out</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Sign in to manage how MoviNesta contacts you.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingScreen message="Loading settings…" />;

  if (isError || !storedPrefs) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card/80 px-4 py-6 text-center text-sm text-foreground shadow-sm">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive opacity-80" />
          <h1 className="text-base font-heading font-semibold">Error</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            We couldn&apos;t load your preferences.
          </p>
          {error && (
            <p className="mt-1 text-[10px] text-muted-foreground font-mono opacity-60">
              {(error as any).message}
            </p>
          )}
        </div>
      </div>
    );
  }

  const initialPrefs: NotificationPrefs = {
    emailActivity: storedPrefs.emailActivity,
    emailRecommendations: storedPrefs.emailRecommendations,
    inAppSocial: storedPrefs.inAppSocial,
    inAppSystem: storedPrefs.inAppSystem,
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-12 pt-1">
      <TopBar title="Notifications" />
      <div className="mx-4 flex items-start gap-2 rounded-md border border-border/40 bg-card/40 p-3 text-[12px] text-muted-foreground shadow-sm backdrop-blur-sm">
        <Info className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <p className="leading-relaxed">
          Notification preferences are saved to your account and sync across all devices.
        </p>
      </div>

      <NotificationsForm
        initialPrefs={initialPrefs}
        user={user}
        onSave={saveToSupabase}
        key={storedPrefs.updated_at}
      />
    </div>
  );
};

export default SettingsNotificationsPage;
