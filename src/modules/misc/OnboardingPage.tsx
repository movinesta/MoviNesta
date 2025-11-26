import React from "react";
import { Link } from "react-router-dom";
import movinestaLogoNeon from "../../assets/brand/movinesta-logo-neon.png";

const OnboardingPage: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-mn-bg text-mn-text-primary">
      {/* Cinematic gradient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.24),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(56,189,248,0.18),_transparent_55%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <div className="mb-8 flex flex-col items-center gap-5">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-mn-bg-elevated/90 shadow-mn-card ring-2 ring-mn-primary/40">
            <img
              src={movinestaLogoNeon}
              alt="MoviNesta logo"
              className="h-24 w-24 rounded-full object-contain"
            />
          </div>

          <div className="max-w-md space-y-2">
            <h1 className="text-2xl font-heading font-semibold">Your movie life, in one nest.</h1>
            <p className="text-sm text-mn-text-secondary">
              MoviNesta keeps your watchlist, recommendations, and movie memories in a single cozy,
              cinematic space. Swipe to discover, log what you watch, and see what your friends are
              into.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link
            to="/auth/signup"
            className="inline-flex min-w-[200px] items-center justify-center rounded-full bg-mn-primary px-5 py-2.5 text-sm font-medium text-white shadow-mn-soft transition hover:bg-mn-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          >
            Get started
          </Link>

          <Link
            to="/auth/signin"
            className="text-xs font-medium text-mn-text-secondary hover:text-mn-primary hover:underline"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
