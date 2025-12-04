import React, { useEffect, useState } from "react";
import { Bell, Inbox, ThumbsUp, AlertCircle, CheckCircle2, Info } from "lucide-react";
import TopBar from "../../components/shared/TopBar";

const STORAGE_KEY = "moviNesta.notifications";

interface NotificationPrefs {
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

const SettingsNotificationsPage: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationPrefs;
        setPrefs({ ...defaultPrefs, ...parsed });
      }
    } catch {
      // ignore parse errors and fall back to defaults
    }
  }, []);

  const updateField =
    (field: keyof NotificationPrefs) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setPrefs((prev) => ({ ...prev, [field]: event.target.checked }));
      setStatus("idle");
    };

  const handleSave = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <TopBar title="Notifications" subtitle="Control how MoviNesta keeps in touch with you." />

      <div className="mx-4 flex items-start gap-2 rounded-md border border-mn-border-subtle/70 bg-mn-bg-elevated/70 p-3 text-[12px] text-mn-text-secondary shadow-mn-card">
        <Info className="mt-0.5 h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
        <p className="leading-relaxed">
          Notification preferences are currently stored on <strong>this device only</strong>.
          Backend sync is coming soon, so changes here won&apos;t update your settings across other
          devices yet.
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
                <span>Notification preferences saved to this device.</span>
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
            className="inline-flex items-center gap-1.5 rounded-full bg-mn-accent/90 px-3.5 py-1.5 text-xs font-medium text-black shadow-mn-card transition hover:bg-mn-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          >
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Save preferences</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsNotificationsPage;
