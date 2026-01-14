import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "./lib/supabaseClient";
import { NavSidebar } from "./components/NavSidebar";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { LoadingState } from "./components/LoadingState";
import { Button } from "./components/Button";
import { whoami, formatAdminError } from "./lib/api";
import { useToast } from "./components/ToastProvider";

const SignIn = lazy(() => import("./pages/SignIn"));
const NotConfigured = lazy(() => import("./pages/NotConfigured"));
const Overview = lazy(() => import("./pages/Overview"));
const Embeddings = lazy(() => import("./pages/Embeddings"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Users = lazy(() => import("./pages/Users"));
const Logs = lazy(() => import("./pages/Logs"));
const Costs = lazy(() => import("./pages/Costs"));
const Audit = lazy(() => import("./pages/Audit"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Settings = lazy(() => import("./pages/Settings"));
const Verification = lazy(() => import("./pages/Verification"));

function FullscreenMsg(props: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-4">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-xl font-semibold tracking-tight">{props.title}</div>
          {props.body ? <div className="mt-2 text-sm text-zinc-600">{props.body}</div> : null}
          {props.action ? <div className="mt-5">{props.action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const appName = useMemo(() => (import.meta.env.VITE_APP_NAME as string | undefined) ?? "MoviNesta Admin", []);
  const configured = isSupabaseConfigured;
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hasValidated, setHasValidated] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const hasValidatedRef = useRef(false);
  const toast = useToast();

  useEffect(() => {
    if (!configured) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const initial = !hasValidatedRef.current;
      if (initial) {
        setChecking(true);
        setAdmin(null);
      } else {
        // Keep the UI stable during token refreshes / background revalidation.
        setRevalidating(true);
      }
      setErr(null);
      if (!configured) {
        setChecking(false);
        setRevalidating(false);
        return;
      }
      try {
        if (!session) {
          setChecking(false);
          setHasValidated(false);
          hasValidatedRef.current = false;
          setRevalidating(false);
          return;
        }
        const r = await whoami();
        if (cancelled) return;
        setAdmin(Boolean(r.is_admin));
        setHasValidated(true);
        hasValidatedRef.current = true;
      } catch (e: any) {
        const msg = formatAdminError(e);
        if (cancelled) return;

        if (!hasValidatedRef.current) {
          setErr(msg);
        } else {
          // Non-blocking error: keep last known admin status on screen.
          toast.push({ variant: "error", title: "Admin check failed", message: msg, durationMs: 5000 });
        }
      } finally {
        if (cancelled) return;
        setChecking(false);
        setRevalidating(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [session, configured]);

  async function signOut() {
    await supabase.auth.signOut();
    setAdmin(null);
    setErr(null);
    setHasValidated(false);
    hasValidatedRef.current = false;
  }

  if (!configured) return <Suspense fallback={<LoadingState />}><NotConfigured /></Suspense>;

  if (!session) return <Suspense fallback={<LoadingState />}><SignIn /></Suspense>;

  if (checking && !hasValidated) {
    return <FullscreenMsg title="Checking permissions…" body="Verifying admin access." />;
  }

  if (err) {
    return (
      <FullscreenMsg
        title="Something went wrong"
        body={err}
        action={
          <Button onClick={signOut}>Sign out</Button>
        }
      />
    );
  }

  if (!admin) {
    return (
      <FullscreenMsg
        title="Not authorized"
        body="Your account is not in app_admins. Ask an existing admin to add your user id."
        action={
          <Button onClick={signOut}>Sign out</Button>
        }
      />
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900">
      <NavSidebar appName={appName} onSignOut={signOut} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">
          {revalidating ? (
            <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
              <span>Revalidating admin access…</span>
            </div>
          ) : null}
          <AppErrorBoundary>
            <Suspense fallback={<LoadingState />}>
              <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/:category" element={<Settings />} />
            <Route path="/embeddings" element={<Embeddings />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/users" element={<Users />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
            </Suspense>
          </AppErrorBoundary>
        </div>
      </div>
    </div>
  );
}