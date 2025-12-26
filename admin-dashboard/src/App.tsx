import React, { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import SignIn from "./pages/SignIn";
import Overview from "./pages/Overview";
import Embeddings from "./pages/Embeddings";
import Jobs from "./pages/Jobs";
import Users from "./pages/Users";
import Logs from "./pages/Logs";
import Costs from "./pages/Costs";
import Audit from "./pages/Audit";
import { NavSidebar } from "./components/NavSidebar";
import { whoami } from "./lib/api";
import { useToast } from "./components/ToastProvider";

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
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hasValidated, setHasValidated] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const hasValidatedRef = useRef(false);
  const toast = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

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
        const msg = e?.message ?? String(e);
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
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
    setAdmin(null);
    setErr(null);
    setHasValidated(false);
    hasValidatedRef.current = false;
  }

  if (!session) return <SignIn />;

  if (checking && !hasValidated) {
    return <FullscreenMsg title="Checking permissions…" body="Verifying admin access." />;
  }

  if (err) {
    return (
      <FullscreenMsg
        title="Something went wrong"
        body={err}
        action={
          <button className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white" onClick={signOut}>
            Sign out
          </button>
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
          <button className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white" onClick={signOut}>
            Sign out
          </button>
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
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/embeddings" element={<Embeddings />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/users" element={<Users />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
