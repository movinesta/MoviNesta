import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { supabase } from "../../lib/supabase";
import { MaterialIcon } from "@/components/ui/material-icon";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

function validateSignUp(
  email: string,
  password: string,
  confirm: string,
  fullName: string,
  username: string,
) {
  const normalizedUsername = username.trim().replace(/^@+/, "").toLowerCase();
  const errors: {
    email?: string;
    password?: string;
    confirm?: string;
    fullName?: string;
    username?: string;
  } = {};

  if (!fullName.trim()) {
    errors.fullName = "Full name is required.";
  }

  if (!normalizedUsername) {
    errors.username = "Username is required.";
  } else if (!USERNAME_REGEX.test(normalizedUsername)) {
    errors.username =
      "Usernames must be 3-30 characters and only include lowercase letters, numbers, or underscores.";
  }

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
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const navigate = useNavigate();

  const isFormValid =
    !!fullName.trim() &&
    !!username.trim() &&
    !!email &&
    !!password &&
    !!confirm &&
    Object.keys(validateSignUp(email, password, confirm, fullName, username)).length === 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const errors = validateSignUp(email, password, confirm, fullName, username);
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

      const trimmedUsername = username.trim().replace(/^@+/, "").toLowerCase();
      const trimmedName = fullName.trim();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: trimmedName,
            username: trimmedUsername,
          },
        },
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

      if (data.user?.id) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ display_name: trimmedName, username: trimmedUsername })
          .eq("id", data.user.id);

        if (profileError) {
          console.warn("[SignUpPage] Failed to update profile details", profileError);
        }
      }

      // Otherwise, user is already signed in
      // Route new accounts through a quick taste onboarding so "For you" works immediately.
      navigate("/onboarding", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Something went wrong while creating your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.12),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.2),_transparent_50%)]" />
        <div className="w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-8 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-none">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-slate-700 transition-colors hover:border-slate-200 hover:bg-white dark:text-slate-200 dark:hover:border-white/10 dark:hover:bg-slate-800"
              aria-label="Go back"
            >
              <MaterialIcon name="arrow_back" className="text-[20px]" ariaLabel="Back" />
            </button>
            <span className="rounded-full border border-slate-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-white/10 dark:text-slate-300">
              Create account
            </span>
          </div>

          <div className="pt-6 text-center">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
              Join the fan hub
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Build your profile and start sharing your favorite titles.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
            >
              <MaterialIcon name="error" className="text-[18px]" ariaLabel="Error" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100"
            >
              <MaterialIcon name="check_circle" className="text-[18px]" ariaLabel="Info" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-3 sm:w-[160px]">
                <div className="group relative cursor-pointer">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-all group-hover:border-primary group-hover:bg-primary/5 dark:border-white/10 dark:bg-slate-900">
                    <MaterialIcon
                      name="add_a_photo"
                      className="text-[28px] text-slate-400 group-hover:text-primary dark:text-slate-500"
                    />
                  </div>
                  <div className="absolute -bottom-2 -right-2 flex items-center justify-center rounded-full border-2 border-white bg-primary p-1 text-white shadow-md dark:border-slate-900">
                    <MaterialIcon name="add" className="text-[14px]" />
                  </div>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Profile
                </p>
              </div>

              <div className="flex flex-1 flex-col gap-4">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Full name
                  <span className="relative flex items-center">
                    <MaterialIcon
                      name="person"
                      className="absolute left-4 z-10 text-slate-400 dark:text-slate-500"
                    />
                    <input
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                      placeholder="Jordan Lee"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (fieldErrors.fullName) {
                          setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                        }
                      }}
                      onBlur={() => {
                        const errors = validateSignUp(
                          email,
                          password,
                          confirm,
                          fullName,
                          username,
                        );
                        if (errors.fullName) {
                          setFieldErrors((prev) => ({ ...prev, fullName: errors.fullName }));
                        }
                      }}
                      disabled={submitting}
                    />
                  </span>
                </label>
                {fieldErrors.fullName && (
                  <p className="text-xs text-red-500">{fieldErrors.fullName}</p>
                )}

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Username
                  <span className="relative flex items-center">
                    <MaterialIcon
                      name="alternate_email"
                      className="absolute left-4 z-10 text-slate-400 dark:text-slate-500"
                    />
                    <input
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                      placeholder="movienesta_fan"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (fieldErrors.username) {
                          setFieldErrors((prev) => ({ ...prev, username: undefined }));
                        }
                      }}
                      onBlur={() => {
                        const errors = validateSignUp(
                          email,
                          password,
                          confirm,
                          fullName,
                          username,
                        );
                        if (errors.username) {
                          setFieldErrors((prev) => ({ ...prev, username: errors.username }));
                        }
                      }}
                      disabled={submitting}
                    />
                  </span>
                </label>
                {fieldErrors.username && (
                  <p className="text-xs text-red-500">{fieldErrors.username}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Email address
                <span className="relative flex items-center">
                  <MaterialIcon
                    name="mail"
                    className="absolute left-4 z-10 text-slate-400 dark:text-slate-500"
                  />
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                    placeholder="name@example.com"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    onBlur={() => {
                      const errors = validateSignUp(
                        email,
                        password,
                        confirm,
                        fullName,
                        username,
                      );
                      if (errors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: errors.email }));
                      }
                    }}
                    disabled={submitting}
                  />
                </span>
              </label>
              {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Password
                <span className="relative flex items-center">
                  <MaterialIcon
                    name="lock"
                    className="absolute left-4 z-10 text-slate-400 dark:text-slate-500"
                  />
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-12 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    onBlur={() => {
                      const errors = validateSignUp(
                        email,
                        password,
                        confirm,
                        fullName,
                        username,
                      );
                      if (errors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: errors.password }));
                      }
                    }}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 z-10 rounded-full p-1 text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <MaterialIcon name={showPassword ? "visibility" : "visibility_off"} />
                  </button>
                </span>
              </label>
              {fieldErrors.password && (
                <p className="text-xs text-red-500">{fieldErrors.password}</p>
              )}

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                Confirm password
                <span className="relative flex items-center">
                  <MaterialIcon
                    name="lock"
                    className="absolute left-4 z-10 text-slate-400 dark:text-slate-500"
                  />
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                    placeholder="Re-enter your password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      if (fieldErrors.confirm) {
                        setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                      }
                    }}
                    onBlur={() => {
                      const errors = validateSignUp(
                        email,
                        password,
                        confirm,
                        fullName,
                        username,
                      );
                      if (errors.confirm) {
                        setFieldErrors((prev) => ({ ...prev, confirm: errors.confirm }));
                      }
                    }}
                    disabled={submitting}
                  />
                </span>
              </label>
              {fieldErrors.confirm && (
                <p className="text-xs text-red-500">{fieldErrors.confirm}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Create Account"}
              <MaterialIcon name="arrow_forward" className="text-[18px]" ariaLabel="Submit" />
            </button>
          </form>

          <div className="relative flex items-center py-6">
            <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
            <span className="mx-4 flex-shrink text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Or join with
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="relative flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
              aria-label="Sign up with Google"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 48 48"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M43.6191 20.0076H24.2862V27.9174H35.4984C34.4601 30.7303 32.7099 32.9691 30.229 34.4055L30.1983 34.619L36.313 39.4623L36.6568 39.4996C40.6622 35.8459 43.1558 30.6713 43.6191 20.0076Z"
                  fill="#4285F4"
                />
                <path
                  d="M24.2862 44C30.4079 44 35.6322 41.9368 39.6738 38.3075L30.229 34.4055C27.6047 36.1423 24.3297 37.218 24.2862 37.218C18.4552 37.218 13.4357 33.3283 11.5976 28.187L11.2372 28.211L4.85695 33.197L4.74751 33.3136C8.80775 41.6508 15.9324 44 24.2862 44Z"
                  fill="#34A853"
                />
                <path
                  d="M11.5975 28.187C11.1394 26.8532 10.899 25.4379 10.899 24C10.899 22.5621 11.1394 21.1468 11.5975 19.813L11.5833 19.664L4.90823 14.733L4.7475 14.808C3.1207 18.0674 2.22754 21.9079 2.22754 26C2.22754 30.0921 3.1207 33.9326 4.7475 37.192L11.5975 28.187Z"
                  fill="#FBBC04"
                />
                <path
                  d="M24.2862 10.7788C27.5684 10.7788 29.8706 12.0006 31.4392 13.4795L39.8662 5.617C35.6111 2.05942 30.4079 0 24.2862 0C15.9324 0 8.80775 2.34919 4.74751 10.6864L11.5975 19.664C13.4357 14.5227 18.4552 10.7788 24.2862 10.7788Z"
                  fill="#EA4335"
                />
              </svg>
            </button>
            <button
              type="button"
              className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
              aria-label="Sign up with Apple"
            >
              <svg
                className="h-6 w-6 text-slate-800 dark:text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              />
            </button>
          </div>

          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Already have an account?{" "}
              <Link to="/auth/signin" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
