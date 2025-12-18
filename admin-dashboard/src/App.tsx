import React, { useEffect, useMemo, useState } from "react";
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

function FullscreenMsg(props: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-4">
        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
          <div className="text-xl font-semibold tracking-tight">{props.title}</div>
          {props.body ? <div className="mt-2 text-sm text-zinc-400">{props.body}</div> : null}
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setChecking(true);
      setErr(null);
      setAdmin(null);
      try {
        if (!session) {
          setChecking(false);
          return;
        }
        const r = await whoami();
        if (cancelled) return;
        setAdmin(Boolean(r.is_admin));
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e));
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
    setAdmin(null);
    setErr(null);
  }

  if (!session) return <SignIn />;

  if (checking) {
    return <FullscreenMsg title="Checking permissions…" body="Verifying admin access." />;
  }

  if (err) {
    return (
      <FullscreenMsg
        title="Something went wrong"
        body={err}
        action={
          <button className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950" onClick={signOut}>
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
          <button className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950" onClick={signOut}>
            Sign out
          </button>
        }
      />
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <NavSidebar appName={appName} onSignOut={signOut} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">
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
