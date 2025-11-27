import React, { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { supabase } from "../../lib/supabase";
import TextField from "../../components/forms/TextField";
import PasswordField from "../../components/forms/PasswordField";
import AuthLayout from "./AuthLayout";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validateSignUp(email: string, password: string, confirm: string) {
  const errors: {
    email?: string;
    password?: string;
    confirm?: string;
  } = {};

  if (!email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!confirm) {
    errors.confirm = "Please confirm your password.";
  } else if (password !== confirm) {
    errors.confirm = "Passwords do not match.";
  }

  return errors;
}

const SignUpPage: React.FC = () => {
  useDocumentTitle("Create account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  const isFormValid =
    !!email &&
    !!password &&
    !!confirm &&
    Object.keys(validateSignUp(email, password, confirm)).length === 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const errors = validateSignUp(email, password, confirm);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(null);
      setInfo(null);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setInfo(null);
      setFieldErrors({});

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message || "Sign-up failed. Please check your details and try again.");
        return;
      }

      // If email confirmation is required, there will be no active session yet.
      if (!data.session) {
        setInfo(
          "Almost there! Check your email inbox for a confirmation link to activate your account.",
        );
        return;
      }

      // Otherwise, user is already signed in
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError("Something went wrong while creating your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      kicker="Join MoviNesta"
      title="Create your account"
      description="Track what you watch, swap recommendations, and keep a cozy cinematic diary."
      footer={
        <span>
          Already have an account?{" "}
          <Link to="/auth/signin" className="font-medium text-mn-primary hover:underline">
            Sign in instead
          </Link>
        </span>
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
        <TextField
          id="signup-email"
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
            const errors = validateSignUp(email, password, confirm);
            if (errors.email) {
              setFieldErrors((prev) => ({ ...prev, email: errors.email }));
            }
          }}
          disabled={submitting}
          error={fieldErrors.email}
        />

        <div className="space-y-1.5">
          <PasswordField
            id="signup-password"
            label="Password"
            ariaLabelBase="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
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
              const errors = validateSignUp(email, password, confirm);
              if (errors.password) {
                setFieldErrors((prev) => ({
                  ...prev,
                  password: errors.password,
                }));
              }
            }}
            disabled={submitting}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={
              fieldErrors.password ? "signup-password-error" : "signup-password-hint"
            }
          />
          {!fieldErrors.password && (
            <p id="signup-password-hint" className="text-xs text-mn-text-muted">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}
          {fieldErrors.password && (
            <p id="signup-password-error" className="text-xs text-mn-error">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <PasswordField
            id="signup-confirm"
            label="Confirm password"
            ariaLabelBase="password confirmation"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (fieldErrors.confirm) {
                setFieldErrors((prev) => ({
                  ...prev,
                  confirm: undefined,
                }));
              }
            }}
            onBlur={() => {
              const errors = validateSignUp(email, password, confirm);
              if (errors.confirm) {
                setFieldErrors((prev) => ({
                  ...prev,
                  confirm: errors.confirm,
                }));
              }
            }}
            disabled={submitting}
            aria-invalid={!!fieldErrors.confirm}
            aria-describedby={fieldErrors.confirm ? "signup-confirm-error" : undefined}
          />
          {fieldErrors.confirm && (
            <p id="signup-confirm-error" className="text-xs text-mn-error">
              {fieldErrors.confirm}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !isFormValid}
          aria-busy={submitting}
          className="inline-flex w-full items-center justify-center rounded-lg bg-mn-primary px-4 py-2 text-sm font-medium text-white shadow-mn-soft hover:bg-mn-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating your account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default SignUpPage;
