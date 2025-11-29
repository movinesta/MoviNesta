import React from "react";
import { useNavigate } from "react-router-dom";
import { Mail, KeyRound, LogOut, AlertCircle } from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../../lib/supabase";

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

    const redirectTo = `${window.location.origin}/auth/reset-password`;
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
        <div className="max-w-md rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-4 py-6 text-center text-sm text-mn-text-primary shadow-mn-card">
          <h1 className="text-base font-heading font-semibold">You&apos;re signed out</h1>
          <p className="mt-2 text-xs text-mn-text-secondary">
            Sign in to view and manage your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <TopBar title="Account" subtitle="Manage the account you use to sign in to MoviNesta." />

      <section className="space-y-4 px-4 pb-24">
        {/* Email + account info */}
        <div className="space-y-3 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 p-4 shadow-mn-card">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-border-subtle/50">
              <Mail className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">Email</h2>
              <p className="text-[11px] text-mn-text-secondary">
                This is the email you use to sign in.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-mn-border-subtle/70 bg-mn-bg/40 px-3 py-2 text-[11px] text-mn-text-secondary">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-mn-text-primary">
                {user.email ?? "No email on file"}
              </span>
              <span className="rounded-full bg-mn-bg px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-mn-text-muted">
                Primary
              </span>
            </div>
            {createdAt && (
              <p className="mt-1 text-[10px] text-mn-text-muted">
                Joined on{" "}
                {createdAt.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>

        {/* Password / security (placeholder for future implementation) */}
        <div className="space-y-3 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 p-4 shadow-mn-card">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-border-subtle/50">
              <KeyRound className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
                Password &amp; security
              </h2>
              <p className="text-[11px] text-mn-text-secondary">
                Send yourself a reset link to change your MoviNesta password.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-mn-border-subtle/70 bg-mn-bg/60 px-3 py-2">
            <p className="text-[11px] text-mn-text-secondary">
              We&apos;ll email a secure link to <span className="font-mono">{user.email}</span>
              <br />
              so you can choose a new password.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resettingPassword}
                className="inline-flex items-center gap-1.5 rounded-full bg-mn-text-primary px-3 py-1.5 text-xs font-semibold text-mn-bg transition hover:bg-mn-text-primary/90 focus:outline-none focus:ring-2 focus:ring-mn-text-primary/30 disabled:opacity-70"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{resettingPassword ? "Sending link…" : "Send reset link"}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/auth/forgot-password", { state: { email: user.email } })}
                className="text-[11px] font-medium text-mn-text-secondary underline-offset-4 transition hover:text-mn-text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-mn-text-primary/30"
              >
                Open reset page
              </button>
            </div>
            {resetMessage && (
              <p className="flex items-center gap-1.5 text-[11px] text-mn-success">
                <span aria-hidden="true">•</span>
                <span>{resetMessage}</span>
              </p>
            )}
          </div>
        </div>

        {/* Sign out */}
        <div className="space-y-2 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 p-4 shadow-mn-card">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">Sign out</h2>
              <p className="text-[11px] text-mn-text-secondary">
                You&apos;ll need to sign in again to use MoviNesta on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-mn-border-subtle/80 px-3 py-1.5 text-xs font-medium text-mn-text-secondary transition hover:border-mn-error/70 hover:bg-mn-error/10 hover:text-mn-error disabled:opacity-70"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>

          {error && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-mn-error">
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
