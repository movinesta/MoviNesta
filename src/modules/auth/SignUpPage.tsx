import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { supabase } from "@/lib/supabase";
import { MaterialIcon } from "@/components/ui/material-icon";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,24}$/;

function validateSignUp(email: string, password: string, fullName: string, username: string) {
  const errors: {
    email?: string;
    password?: string;
    fullName?: string;
    username?: string;
  } = {};

  if (!fullName.trim()) {
    errors.fullName = "Full name is required.";
  }

  if (!username.trim()) {
    errors.username = "Username is required.";
  } else if (!USERNAME_REGEX.test(username.trim())) {
    errors.username =
      "Usernames must be 3-24 characters and only include letters, numbers, underscores, or dots.";
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

  return errors;
}

const SignUpPage: React.FC = () => {
  useDocumentTitle("Create account");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const navigate = useNavigate();

  const isFormValid =
    !!fullName.trim() &&
    !!username.trim() &&
    !!email &&
    !!password &&
    Object.keys(validateSignUp(email, password, fullName, username)).length === 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const errors = validateSignUp(email, password, fullName, username);
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

      const trimmedUsername = username.trim().replace(/^@+/, "");
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

      navigate("/onboarding", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Something went wrong while creating your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background-light text-slate-900 dark:bg-background-dark dark:text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-background-light/80 p-4 pb-2 backdrop-blur-md dark:bg-background-dark/80">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-12 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-slate-200 dark:text-white dark:hover:bg-white/10"
            aria-label="Go back"
          >
            <MaterialIcon name="arrow_back" className="text-[24px]" ariaLabel="Back" />
          </button>
          <div className="text-sm font-medium opacity-0">Sign Up</div>
          <div className="size-12" />
        </div>

        <div className="flex flex-1 flex-col px-6 pb-8">
          <h1 className="pb-2 pt-2 text-center text-[32px] font-bold leading-tight tracking-tight">
            Join the Fan Hub
          </h1>
          <p className="pb-6 text-center text-sm font-normal leading-normal text-[#ad92c9]">
            Connect with fellow movie enthusiasts and share your passion.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {error}
            </div>
          )}

          {info && (
            <div
              role="status"
              className="mb-4 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100"
            >
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center justify-center pt-2">
                <div className="group relative cursor-pointer">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-[#ad92c9]/50 bg-[#362348] transition-all group-hover:border-primary group-hover:bg-primary/5">
                    <MaterialIcon
                      name="add_a_photo"
                      className="text-[32px] text-[#ad92c9] transition-colors group-hover:text-primary"
                      ariaLabel="Upload avatar"
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 flex items-center justify-center rounded-full border-2 border-background-light bg-primary p-1 text-white shadow-lg dark:border-background-dark">
                    <MaterialIcon name="add" className="text-[16px]" ariaLabel="Add" />
                  </div>
                </div>
                <p className="mt-1 text-xs font-medium text-[#ad92c9]">Profile Pic</p>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <label className="group relative flex items-center">
                  <MaterialIcon
                    name="person"
                    className="absolute left-5 z-10 text-[#ad92c9] transition-colors group-focus-within:text-primary"
                    ariaLabel="Full name"
                  />
                  <input
                    className="h-12 w-full rounded-full border-none bg-white pl-14 pr-4 text-base font-normal leading-normal text-slate-900 placeholder:text-[#ad92c9] shadow-sm transition-all focus:bg-white focus:ring-2 focus:ring-primary dark:bg-[#362348] dark:text-white dark:focus:bg-[#432c5a]"
                    placeholder="Full Name"
                    type="text"
                    value={fullName}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      if (fieldErrors.fullName) {
                        setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                      }
                    }}
                    onBlur={() => {
                      const errors = validateSignUp(email, password, fullName, username);
                      if (errors.fullName) {
                        setFieldErrors((prev) => ({ ...prev, fullName: errors.fullName }));
                      }
                    }}
                    disabled={submitting}
                  />
                </label>
                {fieldErrors.fullName && (
                  <p className="text-xs text-red-300">{fieldErrors.fullName}</p>
                )}

                <label className="group relative flex items-center">
                  <MaterialIcon
                    name="alternate_email"
                    className="absolute left-5 z-10 text-[#ad92c9] transition-colors group-focus-within:text-primary"
                    ariaLabel="Username"
                  />
                  <input
                    className="h-12 w-full rounded-full border-none bg-white pl-14 pr-4 text-base font-normal leading-normal text-slate-900 placeholder:text-[#ad92c9] shadow-sm transition-all focus:bg-white focus:ring-2 focus:ring-primary dark:bg-[#362348] dark:text-white dark:focus:bg-[#432c5a]"
                    placeholder="Username"
                    type="text"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      if (fieldErrors.username) {
                        setFieldErrors((prev) => ({ ...prev, username: undefined }));
                      }
                    }}
                    onBlur={() => {
                      const errors = validateSignUp(email, password, fullName, username);
                      if (errors.username) {
                        setFieldErrors((prev) => ({ ...prev, username: errors.username }));
                      }
                    }}
                    disabled={submitting}
                  />
                </label>
                {fieldErrors.username && (
                  <p className="text-xs text-red-300">{fieldErrors.username}</p>
                )}
              </div>
            </div>

            <label className="group relative flex items-center">
              <MaterialIcon
                name="mail"
                className="absolute left-5 z-10 text-[#ad92c9] transition-colors group-focus-within:text-primary"
                ariaLabel="Email"
              />
              <input
                className="h-12 w-full rounded-full border-none bg-white pl-14 pr-4 text-base font-normal leading-normal text-slate-900 placeholder:text-[#ad92c9] shadow-sm transition-all focus:bg-white focus:ring-2 focus:ring-primary dark:bg-[#362348] dark:text-white dark:focus:bg-[#432c5a]"
                placeholder="Email Address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                onBlur={() => {
                  const errors = validateSignUp(email, password, fullName, username);
                  if (errors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: errors.email }));
                  }
                }}
                disabled={submitting}
              />
            </label>
            {fieldErrors.email && <p className="text-xs text-red-300">{fieldErrors.email}</p>}

            <label className="group relative flex items-center">
              <MaterialIcon
                name="lock"
                className="absolute left-5 z-10 text-[#ad92c9] transition-colors group-focus-within:text-primary"
                ariaLabel="Password"
              />
              <input
                className="h-12 w-full rounded-full border-none bg-white pl-14 pr-12 text-base font-normal leading-normal text-slate-900 placeholder:text-[#ad92c9] shadow-sm transition-all focus:bg-white focus:ring-2 focus:ring-primary dark:bg-[#362348] dark:text-white dark:focus:bg-[#432c5a]"
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                onBlur={() => {
                  const errors = validateSignUp(email, password, fullName, username);
                  if (errors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: errors.password }));
                  }
                }}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 z-10 text-[#ad92c9] transition-colors hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <MaterialIcon name={showPassword ? "visibility" : "visibility_off"} />
              </button>
            </label>
            {fieldErrors.password && (
              <p className="text-xs text-red-300">{fieldErrors.password}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-white shadow-[0_0_20px_rgba(127,19,236,0.3)] transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Creating account…" : "Create Account"}
              <MaterialIcon name="arrow_forward" className="text-[20px]" ariaLabel="Submit" />
            </button>
          </form>

          <div className="relative flex items-center py-6">
            <div className="flex-grow border-t border-slate-300 dark:border-[#362348]" />
            <span className="mx-4 text-xs font-medium uppercase tracking-wider text-[#ad92c9]">
              Or join with
            </span>
            <div className="flex-grow border-t border-slate-300 dark:border-[#362348]" />
          </div>

          <div className="-mt-2 flex justify-center gap-4">
            <button
              type="button"
              className="group relative flex size-14 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 dark:border-transparent dark:bg-[#362348] dark:hover:bg-[#432c5a]"
              aria-label="Join with Google"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-red-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <svg
                className="relative z-10 h-7 w-7"
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
              className="flex size-14 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 dark:border-transparent dark:bg-[#362348] dark:text-white dark:hover:bg-[#432c5a]"
              aria-label="Join with Apple"
            >
              <svg
                className="h-8 w-8"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17.4745 16.5164C18.9912 15.1118 20 13.1783 20 11C20 6.02944 15.9706 2 11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C12.8715 20 14.6053 19.4542 16.0353 18.5283C16.1042 19.1601 16.5815 20.0906 17 21L17.4745 16.5164ZM11 18C7.13401 18 4 14.866 4 11C4 7.13401 7.13401 4 11 4C14.866 4 18 7.13401 18 11C18 12.9157 17.1685 14.6543 15.826 15.826L11 18Z" />
              </svg>
            </button>
            <button
              type="button"
              className="flex size-14 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 dark:border-transparent dark:bg-[#362348] dark:hover:bg-[#432c5a]"
              aria-label="Join with Facebook"
            >
              <svg
                className="h-8 w-8 text-[#0866FF]"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </button>
          </div>

          <div className="mt-auto flex flex-col items-center gap-4 pt-8">
            <p className="text-sm font-medium text-[#ad92c9]">
              Already have an account?{" "}
              <Link to="/auth/signin" className="font-semibold text-primary hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
