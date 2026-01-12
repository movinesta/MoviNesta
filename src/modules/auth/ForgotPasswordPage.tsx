import React, { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { supabase } from "../../lib/supabase";
import AuthLayout from "./AuthLayout";
import { buildPasswordResetRedirectUrl } from "@/lib/appUrl";
import { MaterialIcon } from "@/components/ui/material-icon";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordPage: React.FC = () => {
  useDocumentTitle("Forgot password");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);

    try {
      const redirectTo =
        typeof window !== "undefined" ? buildPasswordResetRedirectUrl() : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        setError(
          error.message || "We couldn't send the reset email. Please try again in a moment.",
        );
        return;
      }

      setInfo(
        "If an account exists for that email, we just sent a password reset link. Please check your inbox.",
      );
    } catch (err) {
      console.error(err);
      setError("Something went wrong while requesting the reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      kicker="Reset access"
      title="Forgot your password?"
      description="Enter the email you use for MoviNesta. We'll send a secure link to reset your password."
      footer={
        <Link to="/auth/signin" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label
            htmlFor="forgot-email"
            className="text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Email address
          </label>
          <div className="relative flex items-center">
            <MaterialIcon
              name="mail"
              className="absolute left-4 text-[18px] text-slate-400 dark:text-slate-500"
              ariaLabel="Email"
            />
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="name@example.com"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            We&apos;ll send a secure link that expires shortly.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full rounded-2xl text-sm font-semibold shadow-lg shadow-primary/30"
          disabled={submitting || !email}
        >
          {submitting ? "Sending reset link…" : "Send reset link"}
          <MaterialIcon name="arrow_forward" className="text-[18px]" ariaLabel="Submit" />
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
