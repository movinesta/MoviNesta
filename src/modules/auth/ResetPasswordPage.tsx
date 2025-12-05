import React, { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { supabase } from "../../lib/supabase";
import AuthLayout from "./AuthLayout";

const MIN_PASSWORD_LENGTH = 8;

const ResetPasswordPage: React.FC = () => {
  useDocumentTitle("Reset password");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const navigate = useNavigate();

  // Check if we have a valid user/session from the reset link
  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;

        if (error || !data.user) {
          setError("This password reset link is invalid or has expired. Please request a new one.");
        }
      } catch {
        if (!cancelled) {
          setError("We couldn&apos;t verify your reset link. Please request a new one.");
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    void checkUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message || "We couldn&apos;t update your password. Please try again.");
        return;
      }

      setInfo("Your password has been updated. Redirecting to sign in…");

      // Small delay so the user sees the message
      setTimeout(() => {
        navigate("/auth/signin");
      }, 2500);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while updating your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      kicker="Reset password"
      title="Set a new password"
      description="Choose a strong password to protect your MoviNesta account."
      footer={
        <Link to="/auth/signin" className="font-medium text-mn-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {checking ? (
        <p className="text-sm text-mn-text-secondary">Checking your reset link…</p>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-mn-error/40 bg-mn-error/10 px-3 py-2 text-xs text-mn-error"
            >
              {error}
            </div>
          )}

          {info && (
            <div
              role="status"
              className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-800"
            >
              {info}
            </div>
          )}

          {!info && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="reset-password"
                  className="text-xs font-medium text-mn-text-secondary"
                >
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-lg border border-mn-border bg-mn-bg-input px-3 py-2 text-sm text-mn-text-primary placeholder:text-mn-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                />
                <p className="text-xs text-mn-text-muted">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reset-confirm"
                  className="text-xs font-medium text-mn-text-secondary"
                >
                  Confirm new password
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-lg border border-mn-border bg-mn-bg-input px-3 py-2 text-sm text-mn-text-primary placeholder:text-mn-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="inline-flex w-full items-center justify-center rounded-lg bg-mn-primary px-4 py-2 text-sm font-medium text-white shadow-mn-soft hover:bg-mn-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Updating password…" : "Update password"}
              </button>
            </form>
          )}
        </>
      )}
    </AuthLayout>
  );
};

export default ResetPasswordPage;
