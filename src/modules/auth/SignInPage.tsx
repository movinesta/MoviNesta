import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import React, { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import TextField from "../../components/forms/TextField";
import PasswordField from "../../components/forms/PasswordField";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignIn(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};

  if (!email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  }

  return errors;
}

const SignInPage: React.FC = () => {
  useDocumentTitle("Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // If RequireAuth redirected the user here, it passes the previous location in state
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  const isFormValid =
    !!email && !!password && Object.keys(validateSignIn(email, password)).length === 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const errors = validateSignIn(email, password);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      setFieldErrors({});

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const message =
          error.message === "Invalid login credentials"
            ? "Incorrect email or password. Please try again."
            : error.message || "Sign-in failed. Please try again.";

        setFormError(message);
        return;
      }

      // AuthProvider will pick up the new session via onAuthStateChange
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setFormError("Something went wrong while signing you in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-mn-bg px-4">
      <div className="w-full max-w-md rounded-mn-card border border-mn-border-subtle/60 bg-mn-bg-elevated/95 p-6 shadow-mn-card backdrop-blur">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-heading font-semibold text-mn-text-primary">
            Welcome back to MoviNesta
          </h1>
          <p className="mt-2 text-sm text-mn-text-secondary">
            Sign in to see your diary, feed, and movie matches.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-mn-error/40 bg-mn-error/10 px-3 py-2 text-xs text-mn-error"
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <TextField
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            onBlur={() => {
              const errors = validateSignIn(email, password);
              if (errors.email) {
                setFieldErrors((prev) => ({ ...prev, email: errors.email }));
              }
            }}
            disabled={submitting}
            error={fieldErrors.email}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-xs font-medium text-mn-text-secondary">
                Password
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-xs font-medium text-mn-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordField
              id="password"
              label=""
              ariaLabelBase="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    password: undefined,
                  }));
                }
              }}
              onBlur={() => {
                const errors = validateSignIn(email, password);
                if (errors.password) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    password: errors.password,
                  }));
                }
              }}
              disabled={submitting}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "signin-password-error" : undefined}
            />
            {fieldErrors.password && (
              <p id="signin-password-error" className="text-xs text-mn-error">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !isFormValid}
            aria-busy={submitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-mn-primary px-4 py-2 text-sm font-medium text-white hover:bg-mn-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing you in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-mn-text-muted">
          <span>Don&apos;t have an account? </span>
          <Link to="/auth/signup" className="font-medium text-mn-primary hover:underline">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
