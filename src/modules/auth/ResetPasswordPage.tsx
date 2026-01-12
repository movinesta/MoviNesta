import React, { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { supabase } from "../../lib/supabase";
import AuthLayout from "./AuthLayout";
import { Button } from "@/components/ui/button";

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
        <Link to="/auth/signin" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {checking ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Checking your reset link…
        </p>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {info && (
            <div
              role="status"
              className="rounded-2xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100"
            >
              {info}
            </div>
          )}

          {!info && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="reset-password"
                  className="text-sm font-medium text-slate-700 dark:text-slate-200"
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
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="reset-confirm"
                  className="text-sm font-medium text-slate-700 dark:text-slate-200"
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
                  placeholder="Re-enter your password"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full rounded-2xl text-sm font-semibold shadow-lg shadow-primary/30"
                disabled={submitting}
              >
                {submitting ? "Updating password…" : "Update password"}
              </Button>
            </form>
          )}
        </>
      )}
    </AuthLayout>
  );
};

export default ResetPasswordPage;
