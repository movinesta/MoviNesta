import React from "react";
import { useNavigate } from "react-router-dom";
import { Mail, KeyRound, LogOut, AlertCircle } from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../../lib/supabase";
import { formatDate } from "@/utils/format";
import { buildPasswordResetRedirectUrl } from "@/lib/appUrl";

const SettingsAccountPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = React.useState(false);
  const [resetMessage, setResetMessage] = React.useState<string | null>(null);

  const createdAt = user?.created_at ? new Date(user.created_at) : null;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      navigate("/auth/signin");
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong while signing out.");
      setSigningOut(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email || resettingPassword) return;
    setResetMessage(null);
    setError(null);
    setResettingPassword(true);

    const redirectTo = buildPasswordResetRedirectUrl();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo,
    });

    if (resetError) {
      setError(resetError.message ?? "Unable to send reset email right now.");
    } else {
      setResetMessage(
        "Check your inbox for a password reset link. It may take a minute to arrive.",
      );
    }

    setResettingPassword(false);
  };

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card/80 px-4 py-6 text-center text-sm text-foreground shadow-lg">
          <h1 className="text-base font-heading font-semibold">You&apos;re signed out</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Sign in to view and manage your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <TopBar title="Account" />

      <section className="space-y-4 px-4 pb-24">
        {/* Email + account info */}
        <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-border/50">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-foreground">Email</h2>
              <p className="text-xs text-muted-foreground">This is the email you use to sign in.</p>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-foreground">
                {user.email ?? "No email on file"}
              </span>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Primary
              </span>
            </div>
            {createdAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Joined on{" "}
                {formatDate(createdAt, {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>

        {/* Password / security (placeholder for future implementation) */}
        <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-border/50">
              <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-foreground">
                Password &amp; security
              </h2>
              <p className="text-xs text-muted-foreground">
                Send yourself a reset link to change your MoviNesta password.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border bg-background/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              We&apos;ll email a secure link to <span className="font-mono">{user.email}</span>
              <br />
              so you can choose a new password.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resettingPassword}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-70"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{resettingPassword ? "Sending link…" : "Send reset link"}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/auth/forgot-password", { state: { email: user.email } })}
                className="text-xs font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                Open reset page
              </button>
            </div>
            {resetMessage && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span aria-hidden="true">•</span>
                <span>{resetMessage}</span>
              </p>
            )}
          </div>
        </div>

        {/* Sign out */}
        <div className="space-y-2 rounded-2xl border border-border bg-card/80 p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-foreground">Sign out</h2>
              <p className="text-xs text-muted-foreground">
                You&apos;ll need to sign in again to use MoviNesta on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-destructive/70 hover:bg-destructive/10 hover:text-destructive disabled:opacity-70"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>

          {error && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default SettingsAccountPage;