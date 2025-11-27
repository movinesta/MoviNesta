import React, { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { supabase } from "../../lib/supabase";
import AuthLayout from "./AuthLayout";

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
        typeof window !== "undefined" ? `${window.location.origin}/auth/reset-password` : undefined;

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
        <Link to="/auth/signin" className="font-medium text-mn-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="forgot-email" className="text-xs font-medium text-mn-text-secondary">
            Email address
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-mn-border bg-mn-bg-input px-3 py-2 text-sm text-mn-text-primary placeholder:text-mn-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !email}
          aria-busy={submitting}
          className="inline-flex w-full items-center justify-center rounded-lg bg-mn-primary px-4 py-2 text-sm font-medium text-white shadow-mn-soft hover:bg-mn-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Sending reset link…" : "Send reset link"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
